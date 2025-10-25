// src/components/VoiceChatModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import { API_BASE_URL } from '../utils/api';
import '../css/VoiceChatModal.css';
import Portal from './Portal';
import type { Message } from '../types';
import CodeAnalysisBlock from './CodeAnalysisBlock';
import SearchBlock from './SearchBlock';
import AnalysisBlock from './AnalysisBlock';
import GeolocationBlock from './GeolocationBlock';
import GeolocationRequestBlock from './GeolocationRequestBlock';
import GoogleMapsBlock from './GoogleMapsBlock';
import ImageViewer from './ImageViewer';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEECH_START_THRESHOLD = 0.19; // Start speaking when above this RMS
const SPEECH_STOP_THRESHOLD = 0.15; // Consider silence only when below this RMS (hysteresis)
const SILENCE_DURATION_MS = 2800; // Longer hangover to avoid early cutoff
const MIN_RECORDING_MS = 1100; // Require a bit longer minimum capture
const MIN_AUDIO_BYTES = 2000; // Minimum audio size to send

const VoiceChatModal = ({ isOpen, onClose }: VoiceChatModalProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isMicReady, setIsMicReady] = useState(false); // triggers re-render when mic is ready
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false); // UI hint while waiting for assistant
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const { sendMessage, messages, isStreaming, activeChatId } = useChat();
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
  const smoothedRmsRef = useRef<number>(0);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleOpenViewer = useCallback((src: string) => {
    setViewerSrc(src);
    setIsViewerOpen(true);
  }, []);

  const cleanupResources = useCallback(() => {
    
    
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
                setVoiceError('Slow down! Our voice service is experiencing rate exceed. Please try again later.');
                const key = segmentKey(text);
                if (!spokenSegmentsSetRef.current.has(key)) {
                  spokenSegmentsSetRef.current.add(key);
                  enqueueSpeechFallback(text);
                }
              } else if (msg.includes('429') || msg.includes('Too Many') || msg.includes('concurrent')) {
                providerCooldownUntilRef.current = Date.now() + 2000;
                setVoiceError('Slow down! Our voice service is experiencing rate exceed. Please try again later.');
                const key = segmentKey(text);
                if (!spokenSegmentsSetRef.current.has(key)) {
                  spokenSegmentsSetRef.current.add(key);
                  enqueueSpeechFallback(text);
                }
              } else {
                const emsg = String(err?.message || '').toLowerCase();
                if (emsg.includes('500') || emsg.includes('internal') || emsg.includes('server')) {
                  setVoiceError('Slow down! Our voice service is experiencing rate exceed. Please try again later.');
                }
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
    // Force stop any ongoing speech synthesis and audio playback
    try { if (window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch {}
    try {
      if (audioRef.current) {
        const src = audioRef.current.src;
        audioRef.current.pause();
        audioRef.current.src = '';
        playbackGenerationRef.current += 1; // mark intentional interruption
        if (src && src.startsWith('blob:')) { try { URL.revokeObjectURL(src); } catch {} }
      }
    } catch {}

    // Revoke any queued blob URLs and clear queues
    try {
      for (const item of playbackQueueRef.current) {
        const u = item.url;
        if (u && u.startsWith('blob:')) { try { URL.revokeObjectURL(u); } catch {} }
      }
    } catch {}
    playbackQueueRef.current = [];
    pendingTtsQueueRef.current = [];
    spokenSegmentsSetRef.current.clear();
    ttsServerAvailableRef.current = true;
    replyUseFallbackRef.current = false;
    pendingTextBufferRef.current = '';
    lastAssistantProcessedLenRef.current = 0;

    cleanupResources();
    setIsListening(false);
    setIsSpeaking(false);
    setIsRecording(false);
    setIsMicReady(false);
    lastSpokenMessageIdRef.current = null;

    onClose();
  }, [cleanupResources, onClose]);

  const transcribeAudioBlob = useCallback(async (blob: Blob) => {
    
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
          try { message = JSON.stringify(errorData.error); } catch {}
        }
      } else if (errorData?.detail?.message) {
        message = errorData.detail.message;
      }
      const status = response.status;
      const quotaExceeded =
        errorData?.detail?.status === 'quota_exceeded' ||
        errorData?.error?.detail?.status === 'quota_exceeded' ||
        /quota|rate|exceed/i.test(String(message));
      if (status === 401 || status === 403 || status === 429 || status >= 500 || quotaExceeded) {
        setVoiceError('Slow down! Our voice service is experiencing rate exceed. Please try again later.');
      }
      throw new Error(message);
    }

    const data = await response.json();
    return (data?.transcript as string) || '';
  }, []);

  const handleUserSpeech = useCallback(async (text: string) => {
    
    if (isProcessingRef.current || !text.trim()) {
      
      return;
    }

    
    isProcessingRef.current = true;
    setIsThinking(true);
    

    try {
      await sendMessage(text, [], { isThinkingEnabled: false, voiceMode: true });
    } catch (error) {
      showNotification('Failed to send message', 'error');
    } finally {
      isProcessingRef.current = false;
    }
  }, [sendMessage, showNotification]);

  const stopRecording = useCallback(() => {
    
    
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      
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
      const instantRms = Math.sqrt(sumSquares / dataArray.length);
      // Exponential smoothing to stabilize detection
      const alpha = 0.08; // smoothing factor
      const prev = smoothedRmsRef.current || 0;
      const smoothed = prev + alpha * (instantRms - prev);
      smoothedRmsRef.current = smoothed;

      const now = performance.now();
      const recordingDuration = now - recordingStartTimeRef.current;

      // Hysteresis-based detection: start vs stop thresholds
      if (smoothed > SPEECH_START_THRESHOLD) {
        // Clearly speaking
        lastSoundTimeRef.current = now;
      } else if (smoothed < SPEECH_STOP_THRESHOLD) {
        // Clearly below stop threshold: evaluate silence timeout
        const silenceDuration = now - lastSoundTimeRef.current;
        if (recordingDuration > MIN_RECORDING_MS && silenceDuration > SILENCE_DURATION_MS) {
          
          stopRecording();
          return;
        }
      } else {
        // Between stop and start thresholds: do nothing (neutral zone)
      }

      animationFrameRef.current = requestAnimationFrame(checkLevel);
    };

    animationFrameRef.current = requestAnimationFrame(checkLevel);
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    if (!mediaStreamRef.current || isRecording || isSpeaking || isProcessingRef.current) {
      return;
    }

    
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
      
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];

      if (chunks.length === 0 || isProcessingRef.current) {
        
        return;
      }

      const blob = new Blob(chunks, { type: recorder.mimeType });
      

      if (blob.size < MIN_AUDIO_BYTES) {
        
        return;
      }

      try {
        const text = await transcribeAudioBlob(blob);
        if (text && text.trim()) {
          await handleUserSpeech(text);
        } else {
          
        }
      } catch (error) {
        const msg = String(error instanceof Error ? error.message : error || '');
        const isRate = /quota|rate|exceed|429|unauthorized|401|403/i.test(msg);
        if (isRate) {
          // voiceError is set inside transcribeAudioBlob; avoid noisy toast
        } else {
          showNotification(msg || 'Failed to transcribe audio.', 'error');
        }
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

        
      } catch (error) {
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

  // Build tool blocks for the latest assistant turn (no assistant text rendered)
  const voiceToolBlocks = useCallback(() => {
    if (!messages || messages.length === 0) return null;
    const lastUserIndex = [...messages].findLastIndex((m) => m.role === 'user');
    const startIndex = Math.max(0, lastUserIndex + 1);
    const processedIds = new Set<string>();
    const parts: React.ReactNode[] = [];

    for (let i = startIndex; i < messages.length; i++) {
      const m = messages[i] as Message;
      if (m.role === 'user') break;

      if (m.role === 'tool_code' && m.tool_id && !processedIds.has(m.tool_id)) {
        const out = messages.find((x) => x.role === 'tool_code_result' && x.tool_id === m.tool_id);
        parts.push(
          <CodeAnalysisBlock key={`v-code-${m.tool_id}`} chatId={activeChatId} toolCodeMessage={m} toolOutputMessage={out} onView={handleOpenViewer} />
        );
        processedIds.add(m.tool_id);
      }

      if (m.role === 'tool_search' && m.tool_id && !processedIds.has(m.tool_id)) {
        const out = messages.find((x) => x.role === 'tool_search_result' && x.tool_id === m.tool_id);
        const isGeoMap = out?.content?.includes('[LOCATION]');
        if (isGeoMap) {
          parts.push(
            <GeolocationBlock key={`v-geo-${m.tool_id}`} toolMessage={m} outputMessage={out} />
          );
        } else {
          parts.push(
            <SearchBlock key={`v-search-${m.tool_id}`} toolSearchMessage={m} toolOutputMessage={out} />
          );
        }
        processedIds.add(m.tool_id);
      }

      if (m.role === 'tool_doc_extract' && m.tool_id && !processedIds.has(m.tool_id)) {
        const out = messages.find((x) => x.role === 'tool_doc_extract_result' && x.tool_id === m.tool_id);
        parts.push(
          <AnalysisBlock key={`v-extract-${m.tool_id}`} toolMessage={m} outputMessage={out} />
        );
        processedIds.add(m.tool_id);
      }

      if (m.role === 'tool_geolocation' && m.tool_id && !processedIds.has(m.tool_id)) {
        const hasResult = messages.some((x) => x.role === 'tool_geolocation_result' && x.tool_id === m.tool_id);
        if (!hasResult) {
          parts.push(
            <GeolocationRequestBlock key={`v-geo-req-${m.tool_id}`} toolMessage={m} />
          );
        }
        processedIds.add(m.tool_id);
      }

      if (m.role === 'tool_integration' && m.tool_id && !processedIds.has(m.tool_id)) {
        const out = messages.find((x) => x.role === 'tool_integration_result' && x.tool_id === m.tool_id);
        if (out?.integrationData?.type === 'google_maps_route') {
          parts.push(
            <GoogleMapsBlock key={`v-maps-${m.tool_id}`} integrationData={out.integrationData} />
          );
        }
        processedIds.add(m.tool_id);
      }

      if (m.role === 'tool_integration_result' && m.tool_id && !processedIds.has(m.tool_id)) {
        if (m.integrationData?.type === 'google_maps_route') {
          parts.push(
            <GoogleMapsBlock key={`v-maps-${m.tool_id}`} integrationData={m.integrationData} />
          );
        }
        processedIds.add(m.tool_id);
      }
    }
    if (parts.length === 0) return null;
    return <div className="voice-tools-pane">{parts}</div>;
  }, [messages, activeChatId, handleOpenViewer]);

  // Mic toggling handled automatically; no manual toggle button is shown.

  // Debug sample button removed

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

          {voiceToolBlocks()}

          <div className="voice-chat-info">
            <p className="info-text">
              Ask me anything - I can search the internet, execute code, find directions, and more!
            </p>
          </div>
          {/* Debug button removed */}
          <ImageViewer isOpen={isViewerOpen} src={viewerSrc} alt={viewerSrc || ''} onClose={() => setIsViewerOpen(false)} />
          {voiceError && (
            <div className="voice-error-backdrop" role="dialog" aria-modal="true" aria-label="Voice service error">
              <div className="voice-error-card">
                <div className="voice-error-icon"><FiAlertTriangle size={28} /></div>
                <h3 className="voice-error-title">Slow down</h3>
                <p className="voice-error-message">Our voice service is experiencing rate exceed. Please try again later.</p>
                <div className="voice-error-actions">
                  <button className="voice-error-button" onClick={() => { setVoiceError(null); handleClose(); }}>Got it</button>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </Portal>
  );
};

export default VoiceChatModal;
