// src/components/VoiceChatModal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiMic, FiMicOff } from 'react-icons/fi';
import { useChat } from '../contexts/ChatContext';
import { useNotification } from '../contexts/NotificationContext';
import '../css/VoiceChatModal.css';

interface VoiceChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceChatModal = ({ isOpen, onClose }: VoiceChatModalProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const { sendMessage, messages } = useChat();
  const { showNotification } = useNotification();
  
  const recognitionRef = useRef<any>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isProcessingRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    if (!isOpen) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      showNotification('Speech recognition is not supported in this browser', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        handleUserSpeech(finalTranscript);
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        showNotification('Microphone access denied. Please enable microphone permissions.', 'error');
      }
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isOpen, isListening, showNotification]);

  // Handle user speech
  const handleUserSpeech = useCallback(async (text: string) => {
    if (isProcessingRef.current || !text.trim()) return;
    
    isProcessingRef.current = true;
    setTranscript(text);
    
    try {
      // Send message to AI
      await sendMessage(text, [], { isThinkingEnabled: false });
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('Failed to send message', 'error');
    } finally {
      isProcessingRef.current = false;
    }
  }, [sendMessage, showNotification]);

  // Monitor messages for AI responses
  useEffect(() => {
    if (!isOpen || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.role === 'assistant' && lastMessage.content && !isSpeaking) {
      const content = lastMessage.content;
      setAiResponse(content);
      speakText(content);
    }
  }, [messages, isOpen, isSpeaking]);

  // Text-to-speech function
  const speakText = (text: string) => {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        setTranscript('');
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  };

  // Handle close
  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    window.speechSynthesis.cancel();
    setIsListening(false);
    setIsSpeaking(false);
    setTranscript('');
    setAiResponse('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="voice-chat-overlay" onClick={handleClose}>
      <div className="voice-chat-modal" onClick={(e) => e.stopPropagation()}>
        <button className="voice-chat-close-btn" onClick={handleClose}>
          <FiX size={24} />
        </button>

        <div className="voice-chat-content">
          <div className={`ai-orb ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}>
            <div className="orb-inner"></div>
            <div className="orb-glow"></div>
            <div className="orb-pulse"></div>
          </div>

          <div className="voice-chat-status">
            {isListening && !isSpeaking && (
              <p className="status-text listening">Listening...</p>
            )}
            {isSpeaking && (
              <p className="status-text speaking">Speaking...</p>
            )}
            {!isListening && !isSpeaking && (
              <p className="status-text idle">Press the microphone to start</p>
            )}
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
              className={`voice-control-btn ${isListening ? 'active' : ''}`}
              onClick={toggleListening}
            >
              {isListening ? <FiMicOff size={32} /> : <FiMic size={32} />}
            </button>
          </div>

          <div className="voice-chat-info">
            <p className="info-text">
              Ask me anything - I can search the internet, execute code, find directions, and more!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceChatModal;
