// src/contexts/ChatContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Message } from '../types';
import { useSettings } from './SettingsContext';
import { useNotification } from './NotificationContext';
import api from '../utils/api';

type ChatListItem = {
  _id: string;
  title: string;
  updatedAt: string;
}

interface ChatContextType {
  messages: Message[];
  chatList: ChatListItem[];
  activeChatId: string | null;
  loadChat: (chatId: string) => void;
  clearChat: () => void;
  isLoadingChat: boolean;
  isCreatingChat: boolean;
  sendMessage: (text: string) => Promise<void>;
  isStreaming: boolean;
  editingIndex: number | null;
  startEditing: (index: number) => void;
  cancelEditing: () => void;
  saveAndSubmitEdit: (index: number, newContent: string) => Promise<void>;
  regenerateResponse: () => Promise<void>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { token } = useSettings();
  const { showNotification } = useNotification();

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const loadChatList = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api('/chats');
      if (!response.ok) throw new Error('Failed to fetch chat list');
      const data = await response.json();
      setChatList(data);
    } catch (error) {
      console.error(error);
      showNotification('Could not load chat history.', 'error');
    }
  }, [token, showNotification]);

  useEffect(() => {
    loadChatList();
  }, [loadChatList]);
  
  const streamAndSaveResponse = async (chatId: string, messageHistory: Message[]) => {
    setIsStreaming(true);
    setMessages([...messageHistory, { role: 'assistant', content: '' }]);
    
    try {
      const response = await api(`/chats/${chatId}/stream`, {
        method: 'POST',
        body: JSON.stringify({ messages: messageHistory }),
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Failed to read stream.");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            if (data.content) {
              setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                const updatedLastMessage = { ...lastMessage, content: lastMessage.content + data.content };
                return [...prev.slice(0, -1), updatedLastMessage];
              });
            }
            if (data.error) throw new Error(data.error);
          }
        }
      }
    } catch (error) {
        console.error("Streaming failed:", error);
        showNotification(error instanceof Error ? error.message : "Failed to get response.", "error");
        setMessages(messageHistory);
    } finally {
        setIsStreaming(false);
        await loadChatList();
    }
  };
  
  const sendMessage = async (text: string) => {
    const userMessage: Message = { role: 'user', content: text };
    
    if (!activeChatId) { // This is a new chat
      setIsCreatingChat(true);
      setMessages([userMessage]);

      try {
        const createChatResponse = await api('/chats', {
          method: 'POST',
          body: JSON.stringify({ messages: [userMessage] }),
        });

        if (!createChatResponse.ok) throw new Error('Failed to create chat session.');

        const newChat = await createChatResponse.json();
        
        setActiveChatId(newChat._id);
        navigate(`/c/${newChat._id}`, { replace: true });
        
        await streamAndSaveResponse(newChat._id, [userMessage]);
      } catch (error) {
        console.error(error);
        showNotification('Could not start new chat.', 'error');
        setMessages([]);
        setActiveChatId(null);
        navigate('/', { replace: true });
      } finally {
        setIsCreatingChat(false);
      }
    } else { // This is an existing chat
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      await streamAndSaveResponse(activeChatId, updatedMessages);
    }
  };

  const loadChat = useCallback(async (id: string) => {
    setIsLoadingChat(true);
    try {
      const response = await api(`/chats/${id}`);
      if (!response.ok) throw new Error('Chat not found');
      const data = await response.json();
      setMessages(data.messages);
      setActiveChatId(data._id);
    } catch (error) {
      console.error(error);
      showNotification('Could not load chat.', 'error');
      navigate('/', { replace: true });
    } finally {
      setIsLoadingChat(false);
    }
  }, [navigate, showNotification]);

  const clearChat = useCallback(() => { 
    setMessages([]);
    setActiveChatId(null);
    setEditingIndex(null);
  }, []);

  const startEditing = (index: number) => setEditingIndex(index);
  const cancelEditing = () => setEditingIndex(null);

  const saveAndSubmitEdit = async (index: number, newContent: string) => {
    if (!activeChatId) return;
    const editedHistory = messages.slice(0, index + 1);
    editedHistory[index] = { ...editedHistory[index], content: newContent };
    
    setEditingIndex(null);
    setMessages(editedHistory);
    
    await streamAndSaveResponse(activeChatId, editedHistory);
  };
  
  const regenerateResponse = async () => {
    if (!activeChatId || messages.length < 2) return;
    const historyWithoutLastResponse = messages.slice(0, -1);
    
    setMessages(historyWithoutLastResponse);
    await streamAndSaveResponse(activeChatId, historyWithoutLastResponse);
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      const response = await api(`/chats/${chatId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Failed to rename chat');
      await loadChatList();
      showNotification("Chat renamed!", "success");
    } catch (error) {
      console.error(error);
      showNotification("Could not rename chat.", "error");
      throw error;
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const response = await api(`/chats/${chatId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete chat');
      setChatList(prev => prev.filter(c => c._id !== chatId));
      if (activeChatId === chatId) {
        navigate('/', { replace: true });
        clearChat();
      }
      showNotification("Chat deleted.", "success");
    } catch (error) {
      console.error(error);
      showNotification("Could not delete chat.", "error");
      throw error;
    }
  };

  const value = {
    messages, chatList, activeChatId, loadChat, clearChat, isLoadingChat,
    isCreatingChat, sendMessage, isStreaming, editingIndex, startEditing,
    cancelEditing, saveAndSubmitEdit, regenerateResponse, renameChat, deleteChat
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};