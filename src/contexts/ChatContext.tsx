// src/contexts/ChatContext.tsx

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Message, Attachment } from '../types';
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
  isSending: boolean;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
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
  const [isSending, setIsSending] = useState(false);
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
      
      const streamingToolArguments = new Map<string, string>();
      const streamingToolOutputs = new Map<string, string>();

      try {
          const response = await api(`/chats/${chatId}/stream`, {
              method: 'POST',
              body: JSON.stringify({ messagesFromClient: messageHistory }),
          });
          
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) throw new Error("Failed to read stream.");

          let buffer = '';
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              let boundary = buffer.indexOf('\n\n');
              while (boundary !== -1) {
                  const messageChunk = buffer.substring(0, boundary);
                  buffer = buffer.substring(boundary + 2);
                  const lines = messageChunk.split('\n');
                  for (const line of lines) {
                      if (line.startsWith('data: ')) {
                          const jsonString = line.substring(6).trim();
                          if (jsonString === '[DONE]' || jsonString === '') continue;

                          try {
                              const event = JSON.parse(jsonString);
                              
                              if (event.type === 'error') {
                                if (!event.error.includes('exceeded maximum number of turns')) {
                                    throw new Error(event.error);
                                }
                                continue;
                              }

                              setMessages(prev => {
                                let newMessages = [...prev];
                                switch (event.type) {
                                    case 'TOOL_CODE_CREATE':
                                        return [...prev, event.message];

                                    case 'TOOL_CODE_STREAM': {
                                        const currentArgs = streamingToolArguments.get(event.tool_call_id) || '';
                                        const newArgs = currentArgs + event.content;
                                        streamingToolArguments.set(event.tool_call_id, newArgs);
                                        
                                        const toolCodeIndex = newMessages.findIndex(m => 
                                            m.role === 'tool_code' && m.tool_calls?.some(tc => tc.id === event.tool_call_id)
                                        );
                                        
                                        if (toolCodeIndex !== -1) {
                                            const originalMessage = newMessages[toolCodeIndex];
                                            const newToolCalls = originalMessage.tool_calls?.map(tc => 
                                                tc.id === event.tool_call_id 
                                                ? { ...tc, function: { ...tc.function, arguments: newArgs } } 
                                                : tc
                                            ) ?? [];
                                            
                                            newMessages[toolCodeIndex] = { ...originalMessage, tool_calls: newToolCalls };
                                        }
                                        return newMessages;
                                    }

                                    case 'TOOL_CODE_EXECUTING': {
                                        streamingToolArguments.delete(event.tool_call_id);
                                        const toolCodeIndex = newMessages.findIndex(m => 
                                            m.role === 'tool_code' && m.tool_calls?.some(tc => tc.id === event.tool_call_id)
                                        );
                                        
                                        if (toolCodeIndex !== -1) {
                                            newMessages[toolCodeIndex] = { ...newMessages[toolCodeIndex], state: 'executing' };
                                        }
                                        return newMessages;
                                    }

                                    case 'TOOL_OUTPUT_START': {
                                        const toolCodeIndex = newMessages.findIndex(m =>
                                            m.role === 'tool_code' && m.tool_calls?.some(tc => tc.id === event.tool_call_id)
                                        );
                                        if (toolCodeIndex !== -1) {
                                            newMessages.splice(toolCodeIndex + 1, 0, event.message);
                                        } else {
                                            newMessages.push(event.message);
                                        }
                                        return newMessages;
                                    }

                                    case 'ASSISTANT_DELTA': {
                                        const lastAssistantIndex = newMessages.findLastIndex(m => m.role === 'assistant');
                                        if (lastAssistantIndex === -1 || newMessages[lastAssistantIndex].content === null) {
                                            newMessages.push({ role: 'assistant', content: event.content });
                                        } else {
                                            const originalMessage = newMessages[lastAssistantIndex];
                                            newMessages[lastAssistantIndex] = {
                                                ...originalMessage,
                                                content: (originalMessage.content || '') + event.content
                                            };
                                        }
                                        return newMessages;
                                    }

                                    case 'TOOL_OUTPUT_CHUNK': {
                                        const currentContent = streamingToolOutputs.get(event.tool_call_id) || '';
                                        const newContent = currentContent + event.content;
                                        streamingToolOutputs.set(event.tool_call_id, newContent);
                                        
                                        const toolOutputIndex = newMessages.findIndex(m => 
                                            m.role === 'tool' && m.tool_call_id === event.tool_call_id
                                        );
                                        if (toolOutputIndex !== -1) {
                                            newMessages[toolOutputIndex] = { ...newMessages[toolOutputIndex], content: newContent };
                                        }
                                        return newMessages;
                                    }

                                    case 'TOOL_OUTPUT_COMPLETE': {
                                        streamingToolOutputs.delete(event.tool_call_id);
                                        
                                        // Update the tool output message with the complete content
                                        const toolOutputIndex = newMessages.findIndex(m => 
                                            m.role === 'tool' && m.tool_call_id === event.tool_call_id
                                        );
                                        if (toolOutputIndex !== -1) {
                                            newMessages[toolOutputIndex] = { 
                                                ...newMessages[toolOutputIndex], 
                                                content: event.content || newMessages[toolOutputIndex].content 
                                            };
                                        }
                                        
                                        // Update the tool code message state
                                        const toolCodeIndex = newMessages.findIndex(m => 
                                            m.role === 'tool_code' && m.tool_calls?.some(tc => tc.id === event.tool_call_id)
                                        );
                                        if (toolCodeIndex !== -1) {
                                            newMessages[toolCodeIndex] = { ...newMessages[toolCodeIndex], state: event.state };
                                        }
                                        return newMessages;
                                    }

                                    default:
                                        return prev;
                                }
                            });
                          } catch (error) {
                              console.error("Failed to parse SSE JSON chunk:", jsonString, error);
                          }
                      }
                  }
                  boundary = buffer.indexOf('\n\n');
              }
          }
      } catch (error) {
          console.error("Streaming failed:", error);
          showNotification(error instanceof Error ? error.message : "Failed to get response.", "error");
          setMessages(messageHistory);
      } finally {
          setIsStreaming(false);
          streamingToolArguments.clear();
          streamingToolOutputs.clear();
          await loadChatList();
      }
  };

  const sendMessage = async (text: string, attachments: Attachment[] = []) => {
    if (isStreaming || isSending) return;
    const userMessage: Message = { role: 'user', content: text, attachments };
    const originalMessages = messages;
    setIsSending(true);
    
    try {
      if (!activeChatId) {
        setIsCreatingChat(true);
        setMessages([userMessage]);
        const createChatResponse = await api('/chats', {
          method: 'POST',
          body: JSON.stringify({ messages: [userMessage] }),
        });
        if (!createChatResponse.ok) {
            const errorData = await createChatResponse.json();
            throw new Error(errorData.error || 'Failed to create chat session.');
        }
        const newChat = await createChatResponse.json();
        setMessages(newChat.messages); 
        setActiveChatId(newChat._id);
        navigate(`/c/${newChat._id}`, { replace: true });
        await streamAndSaveResponse(newChat._id, newChat.messages);
      } else {
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        await streamAndSaveResponse(activeChatId, updatedMessages);
      }
    } catch (error) {
      console.error(error);
      showNotification(error instanceof Error ? error.message : 'Could not send message.', 'error');
      if (activeChatId) { setMessages(originalMessages); } 
      else { setMessages([]); setActiveChatId(null); navigate('/', { replace: true }); }
    } finally {
      setIsSending(false);
      setIsCreatingChat(false);
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
    if (!activeChatId || messages.length < 1) return;
    const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;
    const historyWithoutLastResponse = messages.slice(0, lastUserIndex + 1);
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
    isCreatingChat, isSending, sendMessage, isStreaming, editingIndex, startEditing,
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