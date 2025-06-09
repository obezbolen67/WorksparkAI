// src/components/ChatInput.tsx
import { useState, useRef, useEffect } from 'react';
import { FiPlus, FiSend } from 'react-icons/fi';
import { HiOutlineMicrophone } from "react-icons/hi2";
import '../css/ChatInput.css';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
}

const ChatInput = ({ onSendMessage }: ChatInputProps) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = text.trim().length > 0;

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.position = 'absolute';
    hiddenDiv.style.visibility = 'hidden';
    hiddenDiv.style.height = 'auto';
    hiddenDiv.style.width = `${textarea.clientWidth}px`;
    hiddenDiv.style.fontSize = window.getComputedStyle(textarea).fontSize;
    hiddenDiv.style.fontFamily = window.getComputedStyle(textarea).fontFamily;
    hiddenDiv.style.lineHeight = window.getComputedStyle(textarea).lineHeight;
    hiddenDiv.style.padding = '0';
    hiddenDiv.style.border = 'none';
    hiddenDiv.style.wordWrap = 'break-word';
    hiddenDiv.style.whiteSpace = 'pre-wrap';
    
    hiddenDiv.textContent = text || '\u200B';
    
    document.body.appendChild(hiddenDiv);
    const contentHeight = hiddenDiv.scrollHeight;
    document.body.removeChild(hiddenDiv);

    const baseHeight = 24;
    const maxHeight = 120;
    
    if (contentHeight <= baseHeight) {
      textarea.style.height = `${baseHeight}px`;
      textarea.classList.remove('scrollable');
    } else if (contentHeight <= maxHeight) {
      textarea.style.height = `${contentHeight}px`;
      textarea.classList.remove('scrollable');
    } else {
      textarea.style.height = `${maxHeight}px`;
      textarea.classList.add('scrollable');
    }
  };

  const handleInput = () => {
    adjustTextareaHeight();
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  useEffect(() => {
    if (!text && textareaRef.current) {
      textareaRef.current.style.height = '24px';
      textareaRef.current.classList.remove('scrollable');
    }
  }, [text]);

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <button className="chat-input-button">
          <FiPlus size={20} />
        </button>
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Message Fexo..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
        />
        <div className={`chat-input-actions ${hasText ? 'has-text' : ''}`}>
          <button className="chat-input-button mic-button">
            <HiOutlineMicrophone size={20} />
          </button>
          <button
            className="chat-input-button send-button"
            onClick={handleSend}
            disabled={!hasText}
          >
            <FiSend size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;