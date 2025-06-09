// src/components/ChatView.tsx
import { useEffect, useRef } from 'react';
import type { Message } from '../types';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { useNotification } from '../contexts/NotificationContext';
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

  useEffect(() => {
    if (!isLoading && chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => showNotification("Copied!"))
      .catch(() => showNotification("Failed to copy.", "error"));
  };
  
  return (
    <main className={`chat-view ${messages.length === 0 ? 'is-empty' : ''}`}>
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

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
      <div className="chat-input-area">
        <ChatInput onSendMessage={onSendMessage} />
      </div>
    </main>
  );
};

export default ChatView;