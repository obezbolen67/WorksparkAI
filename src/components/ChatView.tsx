// src/components/ChatView.tsx

import { useEffect, useRef, useState } from 'react';
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
  isLoading: boolean;
  isSending: boolean;
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  editingIndex: number | null;
  onStartEdit: (index: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onRegenerate: () => void;
}

const ChatView = (props: ChatViewProps) => {
  const { 
    messages, activeChatId, isStreaming, isLoading, isSending, onSendMessage, 
    editingIndex, onStartEdit, onCancelEdit, onSaveEdit, onRegenerate
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
    // Auto-scroll if we are not manually scrolled up
    if (!isLoading && chatContentRef.current && !showScrollToBottom) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages, isLoading, showScrollToBottom]);

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

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).then(() => showNotification("Copied!"));
  };

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
        
        <div className="chat-content" ref={chatContentRef}>
          {/* The list is always rendered; it's just empty if there are no messages. */}
          <div className="chat-messages-list">
            {messages.map((msg, index) => (
              <ChatMessage 
                key={index}
                index={index}
                message={msg}
                chatId={activeChatId}
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
        </div>

        <div className="chat-input-area">
          {/* "Empty" message is now part of the input area. CSS handles hiding it. */}
          <div className="empty-chat-container">
            <h1>How can I help you?</h1>
          </div>

          {showScrollToBottom && !isStreaming && messages.length > 0 && (
            <Tooltip text="Scroll to latest message">
              <button className="scroll-to-bottom" onClick={scrollToBottom}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </Tooltip>
          )}
          <ChatInput onSendMessage={onSendMessage} isSending={isSending || isStreaming} />
        </div>
      </main>
    </div>
  );
};

export default ChatView;