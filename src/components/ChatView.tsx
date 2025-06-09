import { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import './ChatView.css';
import { RiRobot2Fill } from "react-icons/ri";

const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const chatContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (text: string) => {
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prevMessages => [...prevMessages, userMessage]);

    setTimeout(() => {
      const assistantMessage: Message = {
        role: 'assistant',
        content: `This is a simulated response to: "${text}". The real OpenAI API integration is the next step.`
      };
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
    }, 1000);
  };

  return (
    // Add the conditional 'is-empty' class based on the messages state
    <main className={`chat-view ${messages.length === 0 ? 'is-empty' : ''}`}>
      <div className="chat-content" ref={chatContentRef}>
        {messages.length === 0 ? (
          <div className="empty-chat-container">
            <div className="logo-container">
              <RiRobot2Fill size={48} />
            </div>
            <h1>How can I help you today?</h1>
          </div>
        ) : (
          <div className="chat-messages-list">
            {messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))}
          </div>
        )}
      </div>
      <div className="chat-input-area">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </main>
  );
};

export default ChatView;