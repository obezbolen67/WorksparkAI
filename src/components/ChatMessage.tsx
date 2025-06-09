// src/components/ChatMessage.tsx
import { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import '../css/ChatMessage.css';
import { RiRobot2Fill } from "react-icons/ri";
import { FiCopy, FiRefreshCw, FiEdit } from 'react-icons/fi';

interface ChatMessageProps {
  message: Message;
  index: number;
  isEditing: boolean;
  isStreaming: boolean;
  onRegenerate: () => void;
  onCopy: () => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onCancelEdit: () => void;
}

const ChatMessage = ({ message, index, isEditing, isStreaming, onRegenerate, onCopy, onStartEdit, onSaveEdit, onCancelEdit }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [initialDimensions, setInitialDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (isEditing) {
      setEditedContent(message.content);
      if (messageContentRef.current && bubbleRef.current) {
        const contentRect = messageContentRef.current.getBoundingClientRect();
        const bubbleRect = bubbleRef.current.getBoundingClientRect();
        setInitialDimensions({
          width: bubbleRect.width,
          height: contentRect.height
        });
      }
    } else {
      setInitialDimensions(null);
    }
  }, [isEditing, message.content]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (isEditing && textarea) {
      if (initialDimensions) {
        textarea.style.height = `${initialDimensions.height}px`;
      }
      
      setTimeout(() => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 200;
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 300);
    }
  }, [editedContent, isEditing, initialDimensions]);

  if (isUser) {
    return (
      <div className={`chat-message-wrapper user ${isEditing ? 'editing' : ''}`}>
        <div className="chat-message-container">
          <div 
            ref={bubbleRef}
            className="user-message-bubble"
            style={isEditing && initialDimensions ? {
              '--initial-width': `${initialDimensions.width}px`,
              '--initial-height': `${initialDimensions.height}px`
            } as React.CSSProperties : undefined}
          >
            {!isEditing ? (
              <div ref={messageContentRef} className="message-content">
                {message.content || '\u00A0'}
              </div>
            ) : (
              <div className="message-editor-content">
                <textarea
                  ref={textareaRef}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSaveEdit(index, editedContent);
                    }
                    if (e.key === 'Escape') {
                      onCancelEdit();
                    }
                  }}
                  rows={1}
                />
                <div className="editor-actions">
                  <button className="editor-button cancel" onClick={onCancelEdit}>Cancel</button>
                  <button className="editor-button save" onClick={() => onSaveEdit(index, editedContent)}>Save & Submit</button>
                </div>
              </div>
            )}
          </div>
          {message.content && !isEditing && (
            <div className="message-actions">
              <button className="action-button" title="Edit & Regenerate" onClick={() => onStartEdit(index)}>
                <FiEdit size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className={`chat-message-wrapper assistant`}>
      <div className="chat-message-container">
        <div className="message-icon-col">
          {message.content || isStreaming ? (
            <div className="avatar">
              <RiRobot2Fill size={20} />
            </div>
          ) : null}
        </div>
        <div className="message-content-wrapper">
          <div className="message-content">
            {message.content}
            {isStreaming && <span className="streaming-cursor"></span>}
            {!message.content && !isStreaming && '\u00A0'}
          </div>
          {message.content && !isStreaming && (
            <div className="message-actions">
              <button className="action-button" title="Regenerate" onClick={onRegenerate}>
                <FiRefreshCw size={16} />
              </button>
              <button className="action-button" title="Copy" onClick={onCopy}>
                <FiCopy size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;