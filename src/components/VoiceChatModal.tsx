// src/components/VoiceChatModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { FiX } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import { API_BASE_URL } from '../utils/api';
import '../css/VoiceChatModal.css';
import Portal from './Portal';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEECH_THRESHOLD = 0.32; // RMS threshold to detect speech (raised per request)
const SILENCE_DURATION_MS = 1500; // Stop recording after this much silence
const MIN_RECORDING_MS = 500; // Minimum recording duration
const MIN_AUDIO_BYTES = 2000; // Minimum audio size to send

const VoiceChatModal = ({ isOpen, onClose }: VoiceChatModalProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isMicReady, setIsMicReady] = useState(false); // triggers re-render when mic is ready
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // UI hint while waiting for assistant
  const { sendMessage, messages, isStreaming } = useChat();
  const { user } = useSettings();
  const { showNotification } = useNotification();

  // Kept for potential fallback to browser TTS; not used after switching to ElevenLabs
  // const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const playbackGenerationRef = useRef(0); // increment when we intentionally interrupt playback
  // Playback queue of ready audio URLs; each is played sequentially with no delay
  const playbackQueueRef = useRef<Array<{ url: string; text: string }>>([]);
  const isPlayingQueueRef = useRef(false);
  const ttsServerAvailableRef = useRef(true);
  const pendingTextBufferRef = useRef<string>('');
  const lastAssistantProcessedLenRef = useRef<number>(0);
  const isProcessingRef = useRef(false);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  // removed awaitingAssistantRef gating; auto-resume is based on concrete end-of-turn signals
  // Per-reply management
  const currentReplyIdRef = useRef<string | null>(null);
  const replyUseFallbackRef = useRef<boolean>(false);
  const spokenSegmentsSetRef = useRef<Set<string>>(new Set());
  // TTS concurrency and cooldown
  const maxConcurrentTts = 2;
  const MIN_TTS_SPACING_MS = 250; // small global delay between provider requests
  const SPEECH_GAP_MS = 200; // gap between spoken segments
  const currentFetchesRef = useRef<number>(0);
  const pendingTtsQueueRef = useRef<Array<{ text: string; replyId: string }>>([]);
  const pumpingRef = useRef<boolean>(false);
  const providerCooldownUntilRef = useRef<number>(0);
  const nextAllowedTtsStartAtRef = useRef<number>(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const lastSoundTimeRef = useRef<number>(0);

  const cleanupResources = useCallback(() => {
    console.log('[VoiceChat] Cleaning up resources');
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (_) {}
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    analyserRef.current = null;
    audioChunksRef.current = [];
  }, []);

  // Convert stage directions to speech-friendly cues
  const sanitizeForTTS = (input: string) => {
    let s = input;
    s = s.replace(/\[(laughs|laughing|chuckles)\]/gi, 'Haha,');
    s = s.replace(/\[(surprised|gasp|gasps)\]/gi, 'Oh!');
    s = s.replace(/\[(sigh|sighs)\]/gi, 'Sigh,');
    s = s.replace(/\[[^\]]+\]/g, '');
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  };

  // Fetch TTS URL for a chunk with retry/backoff to handle rate limits
  const fetchTtsUrl = useCallback(async (text: string): Promise<string> => {
    const token = localStorage.getItem('fexo-token');
    const payload = {
      text: sanitizeForTTS(text),
      voiceId: user?.voiceSettings?.voiceId,
    };
    const attempt = async (delayMs: number) => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const response = await fetch(`${API_BASE_URL}/api/voice/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
          ...(token ? { 'x-auth-token': token } : {}),
        },
        body: JSON.stringify(payload),
      });
      return response;
    };
    const backoffs = [0, 600, 1200];
    let lastErr: any = null;
    for (let i = 0; i < backoffs.length; i++) {
      try {
        const res = await attempt(backoffs[i]);
        if (!res.ok) {
          const status = res.status;
          // Try to surface server error json when available
          let serverMsg: string | undefined;
          try {
            const j = await res.json();
            serverMsg = j?.error || j?.detail?.status;
          } catch {}
          if (status === 429 || status >= 500) {
            lastErr = new Error(serverMsg || `TTS failed with ${status}`);
            continue; // retry with next backoff
          } else {
            throw new Error(serverMsg || `TTS request failed (${status})`);
          }
        }
        const arrayBuf = await res.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: 'audio/mpeg' });
        return URL.createObjectURL(blob);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('TTS request failed');
  }, [user?.voiceSettings?.voiceId]);

  const unlockAudioPlayback = useCallback(async () => {
    if (audioUnlockedRef.current) return;
    try {
      // Use Web Audio to unlock audio on user gesture with a 1-frame silent buffer
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      audioUnlockedRef.current = true;
    } catch (err) {
      // Best-effort unlock; continue even if this fails
      // console.warn('[VoiceChat] Audio unlock attempt failed', err);
    }
  }, []);

  const playUrl = useCallback((url: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const myGen = playbackGenerationRef.current;
        const onEnded = () => { cleanup(); resolve(); };
        const onError = (e: any) => {
          if (myGen !== playbackGenerationRef.current) { cleanup(); resolve(); return; }
          cleanup(); reject(e);
        };
        const cleanup = () => {
          audioRef.current?.removeEventListener('ended', onEnded);
          audioRef.current?.removeEventListener('error', onError);
          try { URL.revokeObjectURL(url); } catch {}
        };
        audioRef.current.addEventListener('ended', onEnded);
        audioRef.current.addEventListener('error', onError);
        audioRef.current.src = url;
        audioRef.current.play().catch(onError);
      } catch (e) {
        reject(e);
      }
    });
  }, []);

  const enqueuePlaybackUrl = useCallback((url: string, text: string) => {
    playbackQueueRef.current.push({ url, text });
    // Kick playback loop
    (async () => {
      if (isPlayingQueueRef.current) return;
      isPlayingQueueRef.current = true;
      try {
        while (playbackQueueRef.current.length > 0) {
          const { url } = playbackQueueRef.current.shift()!;
          setIsSpeaking(true);
          setIsThinking(false); // no longer thinking once we start speaking
          try {
            await playUrl(url);
          } catch (err) {
            console.error('[VoiceChat] Playback error:', err);
          }
          // small, natural pause between segments
          if (SPEECH_GAP_MS > 0) {
            await new Promise((r) => setTimeout(r, SPEECH_GAP_MS));
          }
        }
      } finally {
        isPlayingQueueRef.current = false;
  setIsSpeaking(false);
      }
    })();
  }, [playUrl]);

  const segmentKey = useCallback((text: string) => `${text.length}:${text.slice(0, 64)}`, []);

  const enqueueSpeechFallback = useCallback((text: string) => {
    // Queue a SpeechSynthesis utterance to mimic sequential playback
    const makeUtter = (t: string) => {
      const u = new SpeechSynthesisUtterance(t);
      u.rate = 1.0;
      u.pitch = 1.0;
      return u;
    };
  const utter = makeUtter(text);
  utter.onstart = () => { setIsSpeaking(true); setIsThinking(false); };
    utter.onend = () => { setIsSpeaking(false); };
    utter.onerror = () => { setIsSpeaking(false); };
    window.speechSynthesis.speak(utter);
  }, []);

  const pumpTtsQueue = useCallback(() => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    const step = async () => {
      try {
        while (
          pendingTtsQueueRef.current.length > 0 &&
          currentFetchesRef.current < maxConcurrentTts
        ) {
          const nextItem = pendingTtsQueueRef.current[0];
          const text = nextItem?.text || '';
          if (!text.trim()) { pendingTtsQueueRef.current.shift(); continue; }

          const now = Date.now();
          const providerUnavailable =
            replyUseFallbackRef.current ||
            !ttsServerAvailableRef.current ||
            now < providerCooldownUntilRef.current;

          if (providerUnavailable) {
            // Use fallback immediately for this segment
            pendingTtsQueueRef.current.shift();
            const key = segmentKey(text);
            if (!spokenSegmentsSetRef.current.has(key)) {
              spokenSegmentsSetRef.current.add(key);
              enqueueSpeechFallback(text);
            }
            continue;
          }

          // Enforce global spacing between provider requests
          if (now < nextAllowedTtsStartAtRef.current) {
            const delay = Math.max(0, nextAllowedTtsStartAtRef.current - now);
            setTimeout(() => {
              pumpingRef.current = false;
              pumpTtsQueue();
            }, delay);
            return;
          }

          // Start provider request for this item
          const { replyId: itemReplyId } = nextItem;
          pendingTtsQueueRef.current.shift();
          currentFetchesRef.current += 1;
          nextAllowedTtsStartAtRef.current = Date.now() + MIN_TTS_SPACING_MS;
          (async () => {
            try {
              const url = await fetchTtsUrl(text);
              const key = segmentKey(text);
              // Discard if reply changed while fetching
              if (itemReplyId !== currentReplyIdRef.current) {
                try { URL.revokeObjectURL(url); } catch {}
              } else if (!spokenSegmentsSetRef.current.has(key)) {
                enqueuePlaybackUrl(url, text);
              } else {
                try { URL.revokeObjectURL(url); } catch {}
              }
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthor')) {
                ttsServerAvailableRef.current = false;
                replyUseFallbackRef.current = true;
                showNotification('Voice requires sign-in and Pro subscription.', 'error');
                const key = segmentKey(text);
                if (!spokenSegmentsSetRef.current.has(key)) {
                  spokenSegmentsSetRef.current.add(key);
                  enqueueSpeechFallback(text);
                }
              } else if (msg.includes('429') || msg.includes('Too Many') || msg.includes('concurrent')) {
                providerCooldownUntilRef.current = Date.now() + 2000;
                const key = segmentKey(text);
                if (!spokenSegmentsSetRef.current.has(key)) {
                  spokenSegmentsSetRef.current.add(key);
                  enqueueSpeechFallback(text);
                }
              } else {
                console.error('[VoiceChat] TTS fetch failed:', err);
                const key = segmentKey(text);
                if (!spokenSegmentsSetRef.current.has(key)) {
                  spokenSegmentsSetRef.current.add(key);
                  enqueueSpeechFallback(text);
                }
              }
            } finally {
              currentFetchesRef.current -= 1;
              if (pendingTtsQueueRef.current.length > 0) {
                step();
              } else {
                pumpingRef.current = false;
              }
            }
          })();
        }
      } finally {
        if (
          pendingTtsQueueRef.current.length === 0 &&
          currentFetchesRef.current === 0
        ) {
          pumpingRef.current = false;
        }
      }
    };
    step();
  }, [enqueuePlaybackUrl, enqueueSpeechFallback, fetchTtsUrl, segmentKey, showNotification]);

  const fetchAndQueueTts = useCallback((text: string) => {
    const replyId = currentReplyIdRef.current || 'default';
    pendingTtsQueueRef.current.push({ text, replyId });
    pumpTtsQueue();
  }, [pumpTtsQueue]);

  // Deprecated chunk queue retained for reference; no longer used since we speak once per reply

  // Deprecated: queue processor no longer used with single-shot TTS

  // Deprecated: chunked enqueue no longer used (single-shot TTS per reply)

  const handleClose = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
    // Don't accidentally kill playback mid-sentence via overlay clicks
    if (isSpeaking || isPlayingQueueRef.current) {
      showNotification('Still speaking… tap the X to close.');
      return;
    }
    // Clear any pending playback
    playbackQueueRef.current = [];
    pendingTextBufferRef.current = '';
    lastAssistantProcessedLenRef.current = 0;
    cleanupResources();
    setIsListening(false);
    setIsSpeaking(false);
    setIsRecording(false);
    setIsMicReady(false);
  
    lastSpokenMessageIdRef.current = null;
    onClose();
  }, [cleanupResources, onClose, isSpeaking, showNotification]);

  const transcribeAudioBlob = useCallback(async (blob: Blob) => {
    console.log('[VoiceChat] Transcribing audio blob, size:', blob.size);
    const token = localStorage.getItem('fexo-token');
    const formData = new FormData();
    formData.append('audio', blob, `voice-${Date.now()}.webm`);

    const headers: Record<string, string> = {};
    if (token) {
      headers['x-auth-token'] = token;
    }

    const response = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let message = 'Failed to transcribe audio.';
      if (errorData?.error) {
        if (typeof errorData.error === 'string') {
          message = errorData.error;
        } else if (typeof errorData.error === 'object') {
          message = JSON.stringify(errorData.error);
        }
      }
      throw new Error(message);
    }

    const data = await response.json();
    console.log('[VoiceChat] Transcription result:', data?.transcript);
    return (data?.transcript as string) || '';
  }, []);

  const handleUserSpeech = useCallback(async (text: string) => {
    console.log('[VoiceChat] handleUserSpeech called with:', text);
    if (isProcessingRef.current || !text.trim()) {
      console.log('[VoiceChat] Skipping - isProcessing:', isProcessingRef.current, 'empty text:', !text.trim());
      return;
    }

    console.log('[VoiceChat] Starting message processing');
    isProcessingRef.current = true;
    setIsThinking(true);
    

    try {
      console.log('[VoiceChat] Sending message to chat');
      await sendMessage(text, [], { isThinkingEnabled: false, voiceMode: true });
      console.log('[VoiceChat] Message sent successfully');
    } catch (error) {
      console.error('[VoiceChat] Error sending message:', error);
      showNotification('Failed to send message', 'error');
    } finally {
      console.log('[VoiceChat] Message processing complete');
      isProcessingRef.current = false;
    }
  }, [sendMessage, showNotification]);

  const stopRecording = useCallback(() => {
    console.log('[VoiceChat] stopRecording called');
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('[VoiceChat] Stopping MediaRecorder');
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsListening(false);
  }, []);

  const monitorAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Float32Array(analyser.fftSize);

    const checkLevel = () => {
      if (!analyserRef.current || !mediaRecorderRef.current) return;

      analyser.getFloatTimeDomainData(dataArray);

      // Calculate RMS (root mean square) to determine volume level
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      const now = performance.now();
      const recordingDuration = now - recordingStartTimeRef.current;

      // Detect speech
      if (rms > SPEECH_THRESHOLD) {
        // Speech detected
        lastSoundTimeRef.current = now;
      } else {
        const silenceDuration = now - lastSoundTimeRef.current;
        
        // Stop recording if we've had enough silence and minimum recording duration
        if (recordingDuration > MIN_RECORDING_MS && silenceDuration > SILENCE_DURATION_MS) {
          console.log('[VoiceChat] Silence detected, stopping recording');
          stopRecording();
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    animationFrameRef.current = requestAnimationFrame(checkLevel);
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    if (!mediaStreamRef.current || isRecording || isSpeaking || isProcessingRef.current) {
      console.log('[VoiceChat] Cannot start recording - conditions not met');
      return;
    }

    console.log('[VoiceChat] Starting recording');
    audioChunksRef.current = [];
    recordingStartTimeRef.current = performance.now();
    lastSoundTimeRef.current = performance.now();

    // Set up MediaRecorder
    const mimeTypesToTry = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    let selectedMimeType = '';
    for (const mime of mimeTypesToTry) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMimeType = mime;
        break;
      }
    }

    const recorder = new MediaRecorder(
      mediaStreamRef.current,
      selectedMimeType ? { mimeType: selectedMimeType } : undefined
    );
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      console.log('[VoiceChat] MediaRecorder stopped');
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];

      if (chunks.length === 0 || isProcessingRef.current) {
        console.log('[VoiceChat] No chunks or already processing, skipping');
        return;
      }

      const blob = new Blob(chunks, { type: recorder.mimeType });
      console.log('[VoiceChat] Audio blob created, size:', blob.size);

      if (blob.size < MIN_AUDIO_BYTES) {
        console.log('[VoiceChat] Audio too small, skipping transcription');
        return;
      }

      try {
        const text = await transcribeAudioBlob(blob);
        if (text && text.trim()) {
          await handleUserSpeech(text);
        } else {
          console.log('[VoiceChat] Empty transcription');
        }
      } catch (error) {
        console.error('[VoiceChat] Transcription error:', error);
        showNotification(error instanceof Error ? error.message : 'Failed to transcribe audio.', 'error');
      }
    };

    recorder.start(400); // Collect data every 400ms
    setIsRecording(true);
    setIsListening(true);
    

    // Start monitoring audio levels for silence detection
    monitorAudioLevels();
  }, [isRecording, isSpeaking, transcribeAudioBlob, handleUserSpeech, showNotification, monitorAudioLevels]);

  // Initialize audio context and microphone
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        console.log('[VoiceChat] Requesting microphone access');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

  mediaStreamRef.current = stream;
  setIsMicReady(true);

        // Set up audio context and analyser
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        console.log('[VoiceChat] Audio context initialized');
      } catch (error) {
        console.error('[VoiceChat] Failed to initialize voice chat:', error);
        showNotification('Microphone access is required for voice chat.', 'error');
        onClose();
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      setIsMicReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Stop recording while assistant is actively responding (streaming) or speaking
  useEffect(() => {
    if (!isOpen || !isRecording) return;
    // If TTS playback is ongoing, avoid recording to prevent feedback
    if (isSpeaking) {
      stopRecording();
      return;
    }
    // If assistant stream is active (deltas incoming), stop until reply finishes
    if (isStreaming && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        stopRecording();
      }
    }
  }, [isOpen, isRecording, isSpeaking, isStreaming, messages, stopRecording]);

  // After assistant finishes speaking and streaming, automatically resume listening
  useEffect(() => {
    if (!isOpen) return;
    const ready =
      !isSpeaking &&
      !isStreaming &&
      isMicReady &&
      !isRecording &&
      !isProcessingRef.current &&
      playbackQueueRef.current.length === 0 &&
      pendingTtsQueueRef.current.length === 0 &&
      currentFetchesRef.current === 0 &&
      pendingTextBufferRef.current.trim().length === 0;
    let t: number | undefined;
    if (ready) {
      // small cooldown to avoid rapid start/stop oscillation
      t = window.setTimeout(() => {
        startRecording();
      }, 350);
    }
    return () => { if (t) window.clearTimeout(t); };
  }, [isSpeaking, isStreaming, isOpen, isMicReady, isRecording, startRecording]);

  // Stream assistant deltas into finalized chunks; for each chunk, immediately request TTS and queue the audio for playback
  useEffect(() => {
    if (!isOpen || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;
    const content = lastMessage.content || '';

    // Reset counters when a new assistant reply starts (content shrank)
    if (content.length < lastAssistantProcessedLenRef.current) {
      // New assistant reply started
      pendingTextBufferRef.current = '';
      lastAssistantProcessedLenRef.current = 0;
      currentReplyIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      replyUseFallbackRef.current = false;
      spokenSegmentsSetRef.current.clear();
      // Interrupt any ongoing playback from previous reply and clear queued items
      try { if (window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch {}
      try {
        if (audioRef.current) {
          const src = audioRef.current.src;
          audioRef.current.pause();
          audioRef.current.src = '';
          playbackGenerationRef.current += 1;
          if (src && src.startsWith('blob:')) { try { URL.revokeObjectURL(src); } catch {} }
        }
      } catch {}
      playbackQueueRef.current = [];
      pendingTtsQueueRef.current = [];
    }
    if (!currentReplyIdRef.current) {
      currentReplyIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    if (content.length > lastAssistantProcessedLenRef.current) {
      const delta = content.substring(lastAssistantProcessedLenRef.current);
      pendingTextBufferRef.current += delta;
      lastAssistantProcessedLenRef.current = content.length;

  // Finalize chunks on strong punctuation or if buffer is long to reduce latency
      const segments: string[] = [];
      const regex = /(.*?[\.!\?])(\s|$)/g;
      let match;
      let consumed = 0;
      while ((match = regex.exec(pendingTextBufferRef.current)) !== null) {
        const seg = match[1].trim();
        if (seg) segments.push(seg);
        consumed = regex.lastIndex;
      }
      // If no sentence end yet but buffer is long, flush mid-chunk to keep audio flowing
      if (segments.length === 0 && pendingTextBufferRef.current.length > 260) {
        const cut = pendingTextBufferRef.current.slice(0, 260);
        const lastSpace = cut.lastIndexOf(' ');
        const seg = cut.slice(0, lastSpace > 140 ? lastSpace : cut.length).trim();
        if (seg) {
          segments.push(seg);
          consumed = seg.length;
        }
      }

      if (segments.length > 0) {
        pendingTextBufferRef.current = pendingTextBufferRef.current.slice(consumed);
        // Fire TTS requests immediately; playback will start as audio becomes ready
        for (const seg of segments) {
          fetchAndQueueTts(seg);
        }
      }
    }
  }, [messages, isOpen, fetchAndQueueTts]);

  // Flush any leftover text at end of streaming
  useEffect(() => {
    if (!isOpen) return;
    if (isStreaming) return;
    const leftover = pendingTextBufferRef.current.trim();
    if (leftover) {
      pendingTextBufferRef.current = '';
      fetchAndQueueTts(leftover);
    }
    // No additional gating; auto-restart effect handles readiness
  }, [isOpen, isStreaming, fetchAndQueueTts]);

  // Mic toggling handled automatically; no manual toggle button is shown.

  const triggerDebugSample = useCallback(() => {
    const sampleText = 'This is a debug voice sample message.';
    handleUserSpeech(sampleText);
  }, [handleUserSpeech]);

  if (!isOpen) return null;

  let statusText = 'Initializing microphone...';
  let statusClass = 'idle';

  if (isMicReady) {
    if (isSpeaking) {
      statusText = 'Speaking...';
      statusClass = 'speaking';
    } else if (isRecording) {
      statusText = 'Recording... (speak now)';
      statusClass = 'listening';
    } else if (isThinking) {
      statusText = 'Thinking...';
      statusClass = 'listening';
    } else if (isListening && !isRecording) {
      statusText = 'Processing...';
      statusClass = 'listening';
    } else {
      statusText = 'Say something to start';
      statusClass = 'idle';
    }
  }

  return (
    <Portal>
      <div className="voice-chat-overlay">
        <div className="voice-chat-modal" onClick={(e) => e.stopPropagation()}>
        <button className="voice-chat-close-btn" onClick={handleClose}>
          <FiX size={24} />
        </button>

        <div className="voice-chat-content">
          <div className={`ai-orb ${isSpeaking ? 'speaking' : ''} ${isRecording ? 'listening' : ''}`}>
            <div className="orb-inner"></div>
            <div className="orb-glow"></div>
            <div className="orb-pulse"></div>
          </div>

          <div className="voice-chat-status">
            <p className={`status-text ${statusClass}`}>{statusText}</p>
          </div>

            {/* Caption removed as requested */}

          <div className="voice-chat-controls">
            <div
              className={`voice-dots ${isThinking ? 'thinking' : ''}`}
              onClick={() => unlockAudioPlayback().catch(() => {})}
              role="button"
              aria-label="Speech status indicator"
              title="Speech status"
            >
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>

          <div className="voice-chat-info">
            <p className="info-text">
              Ask me anything - I can search the internet, execute code, find directions, and more!
            </p>
          </div>
          <button
            className="voice-debug-btn"
            type="button"
            onClick={triggerDebugSample}
          >
            Run Debug Sample
          </button>
        </div>
        </div>
      </div>
    </Portal>
  );
};

export default VoiceChatModal;
