import { useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { useNotification } from '../contexts/NotificationContext';
import ModelSelector from './ModelSelector';
import '../css/ChatView.css';

interface ChatViewProps {
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  editingIndex: number | null;
  onStartEdit: (index: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onRegenerate: () => void;
}

const ChatView = (props: ChatViewProps) => {
  const { 
    messages, isStreaming, isLoading, onSendMessage, editingIndex,
    onStartEdit, onCancelEdit, onSaveEdit, onRegenerate
  } = props;

  const chatContentRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useNotification();
  const [isReady, setIsReady] = useState(false);
  // --- NEW: State for scroll button visibility ---
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100); 
    return () => clearTimeout(timer);
  }, []);

  // This effect ensures the view auto-scrolls when new messages are added.
  useEffect(() => {
    if (!isLoading && chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // --- NEW: Effect to detect user scroll and show/hide the button ---
  useEffect(() => {
    const chatContent = chatContentRef.current;
    if (!chatContent) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContent;
      // Show button if user has scrolled up more than 300px from the bottom
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
      setShowScrollToBottom(isScrolledUp);
    };

    // Listen for scroll events on the chat content area
    chatContent.addEventListener('scroll', handleScroll, { passive: true });

    // Clean up the event listener when the component unmounts
    return () => chatContent.removeEventListener('scroll', handleScroll);
  }, []); // Run only once on mount

  const handleCopy = (content: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(content)
        .then(() => showNotification("Copied!"))
        .catch(() => legacyCopy(content));
    } else {
      legacyCopy(content);
    }
  };

  const legacyCopy = (content: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (success) {
        showNotification("Copied!");
      } else {
        showNotification("Failed to copy.", "error");
      }
    } catch (err) {
      console.error('Copy failed:', err);
      showNotification("Failed to copy.", "error");
    }
  };

  // --- NEW: Function to smoothly scroll to the bottom ---
  const scrollToBottom = () => {
    chatContentRef.current?.scrollTo({
      top: chatContentRef.current.scrollHeight,
      behavior: 'smooth'
    });
  };

  return (
    <div className={`chat-view-container ${messages.length === 0 ? 'is-empty' : ''} ${isReady ? 'is-ready' : ''}`}>
      <header className="chat-view-header">
        <ModelSelector />
      </header>
      
      <main className="chat-view">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
        
        <div className="chat-view-spacer-top" />

        <div className="chat-content" ref={chatContentRef}>
          {messages.length === 0 && !isLoading ? (
            <div className="empty-chat-container">
              <h1>How can I help you?</h1>
            </div>
          ) : (
            <div className="chat-messages-list">
              {messages.map((msg, index) => (
                <ChatMessage 
                  key={index}
                  index={index}
                  message={msg}
                  isEditing={editingIndex === index}
                  isStreaming={isStreaming && index === messages.length - 1}
                  onRegenerate={onRegenerate}
                  onCopy={() => handleCopy(msg.content)}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                />
              ))}
            </div>
          )}
        </div>

        {/* --- UPDATED: chat-input-area now contains the scroll button --- */}
        <div className="chat-input-area">
          {showScrollToBottom && !isStreaming && messages.length > 0 && (
            <button 
              className="scroll-to-bottom" 
              onClick={scrollToBottom}
              title="Scroll to latest message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
          <ChatInput onSendMessage={onSendMessage} />
        </div>
        
        <div className="chat-view-spacer-bottom" />
      </main>
    </div>
  );
};

export default ChatView;