// src/components/ChatView.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Message, Attachment } from '../types';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { useNotification } from '../contexts/NotificationContext';
import ModelSelector from './ModelSelector';
import '../css/ChatView.css';
import Tooltip from './Tooltip';

interface ChatViewProps {
  messages: Message[];
  activeChatId: string | null;
  isStreaming: boolean;
  isThinking: boolean;
  isLoading: boolean;
  isSending: boolean;
  onSendMessage: (text: string, attachments: Attachment[], metadata?: Record<string, any>) => void;
  onStopGeneration: () => void; // <-- NEW
  editingIndex: number | null;
  onStartEdit: (index: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (index: number, newContent: string, metadata?: Record<string, any>) => void;
  onRegenerate: (metadata?: Record<string, any>) => void;
  isThinkingEnabled: boolean;
  toggleThinkingEnabled : () => void;
}

const ChatView = (props: ChatViewProps) => {
  const { 
    messages, activeChatId, isStreaming, isThinking, isLoading, isSending, onSendMessage, 
    onStopGeneration, // <-- NEW
    editingIndex, onStartEdit, onCancelEdit, 
    onSaveEdit, onRegenerate, isThinkingEnabled
  } = props;

  const chatContentRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useNotification();
  const [isReady, setIsReady] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (chatContentRef.current && !showScrollToBottom) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages, isLoading, showScrollToBottom, isStreaming, isThinking]);

  useEffect(() => {
    const chatContent = chatContentRef.current;
    if (!chatContent) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContent;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
      setShowScrollToBottom(isScrolledUp);
    };
    chatContent.addEventListener('scroll', handleScroll, { passive: true });
    return () => chatContent.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => showNotification("Copied!"));
  }, [showNotification]);

  const scrollToBottom = () => {
    chatContentRef.current?.scrollTo({ top: chatContentRef.current.scrollHeight, behavior: 'smooth' });
  };

  const handleSendMessage = (text: string, attachments: Attachment[]) => {
    onSendMessage(text, attachments);
  };
  
  const handleRegenerate = () => {
    onRegenerate();
  };

  return (
    <div className={`chat-view-container ${messages.length === 0 ? 'is-empty' : ''} ${isReady ? 'is-ready' : ''}`}>
      <header className="chat-view-header">
        <ModelSelector />
      </header>
      
      <main className="chat-view">
        {isLoading && (
          <div className="loading-overlay">
            <div className="bouncing-loader"><div></div><div></div><div></div></div>
          </div>
        )}
        
        <div className="chat-content" ref={chatContentRef}>
          <div className="chat-messages-list">
            {messages.filter(msg => msg != null).map((msg, index) => {
              return (
                <ChatMessage
                  key={activeChatId ? `${activeChatId}-${index}` : index}
                  index={index}
                  message={msg}
                  messages={messages}
                  chatId={activeChatId}
                  isEditing={editingIndex === index}
                  isStreaming={isStreaming}
                  isThinking={isThinking}
                  onRegenerate={handleRegenerate}
                  onCopy={handleCopy}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                />
              );
            })}
          </div>
        </div>

        <div className="chat-input-area">
          <div className="empty-chat-container">
            <h1>How can I help you?</h1>
          </div>

          {showScrollToBottom && !isStreaming && messages.length > 0 && (
            <Tooltip text="Scroll to latest message">
              <button className="scroll-to-bottom" onClick={scrollToBottom}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </Tooltip>
          )}
          <ChatInput 
            onSendMessage={handleSendMessage} 
            onStopGeneration={onStopGeneration}
            isSending={isSending || isStreaming}
            isThinkingVisible={isThinkingEnabled}
          />
        </div>
      </main>
    </div>
  );
};

export default ChatView;