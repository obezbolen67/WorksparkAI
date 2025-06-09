// src/components/ChatView.tsx
import { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import '../css/ChatView.css';

const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { user, token } = useSettings(); // Get user and token
  const chatContentRef = useRef<HTMLDivElement>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const { showNotification } = useNotification();


  useEffect(() => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
  }, [messages]);

  const streamAssistantResponse = async (messageHistory: Message[]) => {
    setIsStreaming(true);
    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token || '' // Add token to header
        },
        body: JSON.stringify({
          messages: messageHistory,
          // No need to send api key, base url, or model anymore
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');
      
      const decoder = new TextDecoder();
      let assistantResponse = ''; // Keep track of the full response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.content) {
                assistantResponse += data.content;
                setMessages(prev => prev.map((msg, index) => 
                  index === prev.length - 1 
                    ? { ...msg, content: assistantResponse }
                    : msg
                ));
              }
            } catch (e) {
                console.error("Failed to parse stream chunk", line)
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessages(prev => prev.map((msg, index) =>
        index === prev.length - 1
          ? { ...msg, content: `Error: ${errorMessage}` }
          : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (isStreaming) return;
    if (!user?.apiKey || !user?.selectedModel) {
      showNotification("Please set your API Key and select a model in Settings.", 'error');
      return;
    }

    const userMessage: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    await streamAssistantResponse(newMessages);
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (isStreaming) return;
    if (!user?.apiKey || !user?.selectedModel) {
        showNotification("Please set your API Key and select a model in Settings.", 'error');
        return;
    }
    const context = messages.slice(0, messageIndex);
    
    setMessages([...context, { role: 'assistant', content: '' }]);
    await streamAssistantResponse(context);
  };

  const handleStartEdit = (index: number) => {
    if (isStreaming) return;
    setEditingMessageIndex(index);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
  };

  const handleSaveEdit = async (index: number, newContent: string) => {
    const originalContent = messages[index].content;
    if (!newContent.trim() || newContent === originalContent) {
      setEditingMessageIndex(null);
      return;
    }

    if (!user?.apiKey || !user?.selectedModel) {
        showNotification("Please set your API Key and select a model in Settings.", 'error');
        return;
    }

    setEditingMessageIndex(null);
    const context = messages.slice(0, index);
    const updatedUserMessage: Message = { role: 'user', content: newContent };
    const newMessages = [...context, updatedUserMessage];

    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    await streamAssistantResponse(newMessages);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        showNotification("Copied!");
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        showNotification("Failed to copy.");
      });
  };


  return (
    <main className={`chat-view ${messages.length === 0 ? 'is-empty' : ''}`}>
      <div className="chat-content" ref={chatContentRef}>
        {messages.length === 0 ? (
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
                isEditing={editingMessageIndex === index}
                isStreaming={isStreaming && index === messages.length - 1}
                onRegenerate={() => handleRegenerate(index)}
                onCopy={() => handleCopy(msg.content)}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
              />
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