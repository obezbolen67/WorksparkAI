// src/components/VoiceChatModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiMic, FiMicOff } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import { useNotification } from '../contexts/NotificationContext';
import { API_BASE_URL } from '../utils/api';
import '../css/VoiceChatModal.css';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPEECH_THRESHOLD = 0.02; // RMS threshold to detect speech
const SILENCE_DURATION_MS = 1500; // Stop recording after this much silence
const MIN_RECORDING_MS = 500; // Minimum recording duration
const MIN_AUDIO_BYTES = 2000; // Minimum audio size to send

const VoiceChatModal = ({ isOpen, onClose }: VoiceChatModalProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const { sendMessage, messages } = useChat();
  const { showNotification } = useNotification();

  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isProcessingRef = useRef(false);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

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

  const speakText = useCallback((text: string) => {
    console.log('[VoiceChat] speakText called with:', text);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      console.log('[VoiceChat] TTS onstart - AI speaking');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('[VoiceChat] TTS onend - AI finished speaking');
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      if (event.error !== 'interrupted') {
        console.error('[VoiceChat] Speech synthesis error:', event);
      }
      setIsSpeaking(false);
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    console.log('[VoiceChat] TTS started');
  }, []);

  const handleClose = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    cleanupResources();
    setIsListening(false);
    setIsSpeaking(false);
    setIsRecording(false);
    setTranscript('');
    setAiResponse('');
    lastSpokenMessageIdRef.current = null;
    onClose();
  }, [cleanupResources, onClose]);

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
    setTranscript(text);

    try {
      console.log('[VoiceChat] Sending message to chat');
      await sendMessage(text, [], { isThinkingEnabled: false });
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
        console.log('[VoiceChat] Speech detected, RMS:', rms.toFixed(4));
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
        setTranscript('');
        return;
      }

      try {
        setTranscript('Processing...');
        const text = await transcribeAudioBlob(blob);
        if (text && text.trim()) {
          setTranscript(text);
          await handleUserSpeech(text);
        } else {
          console.log('[VoiceChat] Empty transcription');
          setTranscript('');
        }
      } catch (error) {
        console.error('[VoiceChat] Transcription error:', error);
        showNotification(error instanceof Error ? error.message : 'Failed to transcribe audio.', 'error');
        setTranscript('');
      }
    };

    recorder.start(400); // Collect data every 400ms
    setIsRecording(true);
    setIsListening(true);
    setTranscript('');

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle AI responses
  useEffect(() => {
    if (!isOpen || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.role === 'assistant' && lastMessage.content) {
      const messageId = `${messages.length}-${lastMessage.content.substring(0, 50)}`;
      
      if (messageId !== lastSpokenMessageIdRef.current) {
        console.log('[VoiceChat] New assistant message, will speak after stopping recording');
        lastSpokenMessageIdRef.current = messageId;
        
        const content = lastMessage.content;
        setAiResponse(content);
        
        // Stop any ongoing recording before speaking
        if (isRecording) {
          console.log('[VoiceChat] Stopping recording before AI speaks');
          stopRecording();
        }
        
        speakText(content);
      }
    }
  }, [messages, isOpen, isRecording, speakText, stopRecording]);

  const toggleListening = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const triggerDebugSample = useCallback(() => {
    const sampleText = 'This is a debug voice sample message.';
    handleUserSpeech(sampleText);
  }, [handleUserSpeech]);

  // Calculate sidebar width for proper positioning
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const sidebar = document.querySelector('.sidebar');
    
    const updateSidebarWidth = () => {
      if (sidebar) {
        const width = sidebar.getBoundingClientRect().width;
        setSidebarWidth(width);
      }
    };
    
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    updateSidebarWidth();
    updateIsMobile();
    
    // Listen for sidebar width changes
    const resizeObserver = new ResizeObserver(updateSidebarWidth);
    if (sidebar) {
      resizeObserver.observe(sidebar);
    }
    
    // Listen for window resize for mobile detection
    window.addEventListener('resize', updateIsMobile);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateIsMobile);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  let statusText = 'Initializing microphone...';
  let statusClass = 'idle';

  if (mediaStreamRef.current) {
    if (isSpeaking) {
      statusText = 'Speaking...';
      statusClass = 'speaking';
    } else if (isRecording) {
      statusText = 'Recording... (speak now)';
      statusClass = 'listening';
    } else if (isListening && !isRecording) {
      statusText = 'Processing...';
      statusClass = 'listening';
    } else {
      statusText = 'Press the microphone to start';
      statusClass = 'idle';
    }
  }

  return (
    <div 
      className="voice-chat-overlay" 
      onClick={handleClose}
      style={{ left: isMobile ? 0 : `${sidebarWidth}px` }}
    >
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

          {transcript && (
            <div className="transcript-display">
              <p className="transcript-label">You said:</p>
              <p className="transcript-text">{transcript}</p>
            </div>
          )}

          {aiResponse && !isSpeaking && (
            <div className="response-display">
              <p className="response-label">AI Response:</p>
              <p className="response-text">{aiResponse}</p>
            </div>
          )}

          <div className="voice-chat-controls">
            <button
              className={`voice-control-btn ${isRecording ? 'active' : ''}`}
              onClick={toggleListening}
              disabled={!mediaStreamRef.current || isSpeaking}
            >
              {isRecording ? <FiMicOff size={32} /> : <FiMic size={32} />}
            </button>
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
  );
};

export default VoiceChatModal;
