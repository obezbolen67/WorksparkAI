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
  sendMessage: (text: string, attachments: Attachment[], metadata?: Record<string, any>) => Promise<void>;
  isStreaming: boolean;
  isThinking: boolean;
  thinkingContent: string | null;
  editingIndex: number | null;
  startEditing: (index: number) => void;
  cancelEditing: () => void;
  saveAndSubmitEdit: (index: number, newContent: string) => Promise<void>;
  regenerateResponse: (metadata?: Record<string, any>) => Promise<void>;
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
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);

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

  const streamAndSaveResponse = async (
      chatId: string,
      messageHistory: Message[],
      metadata?: Record<string, any>
  ) => {
      console.log('%c[CLIENT] Starting Stream', 'color: blue; font-weight: bold;', {
          chatId,
          messageHistory: JSON.parse(JSON.stringify(messageHistory)),
          metadata,
      });

      setMessages(messageHistory);
      setIsStreaming(true);
      setIsThinking(false);
      setThinkingContent(null);

      let currentAssistantThinking = '';
      let assistantMessageIndex = -1;

      try {
          const response = await api(`/chats/${chatId}/stream`, {
              method: 'POST',
              body: JSON.stringify({ messagesFromClient: messageHistory, metadata }),
          });

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({error: "Streaming failed with status " + response.status}));
              throw new Error(errorData.error);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) throw new Error("Failed to read stream.");

          let buffer = '';
          while (true) {
              const { done, value } = await reader.read();
              if (done) {
                  console.log('%c[CLIENT] Stream Finished', 'color: blue; font-weight: bold;');
                  break;
              }

              buffer += decoder.decode(value, { stream: true });
              let boundary = buffer.indexOf('\n\n');
              while (boundary !== -1) {
                  const messageChunk = buffer.substring(0, boundary);
                  buffer = buffer.substring(boundary + 2);
                  const lines = messageChunk.split('\n');

                  for (const line of lines) {
                      if (!line.startsWith('data: ')) continue;
                      const jsonString = line.substring(6).trim();
                      if (jsonString === '{"type":"done"}' || !jsonString) continue;

                      try {
                          const event = JSON.parse(jsonString);
                          console.log(`%c[CLIENT] SSE Received:`, 'color: green;', event.type, event);

                          if (event.type === 'error') throw new Error(event.error.message || event.error);
                          
                          switch (event.type) {
                              case 'THINKING_START':
                                setMessages(prev => {
                                    console.log('[CLIENT-STATE] setMessages for THINKING_START. Prev length:', prev.length);
                                    const newMessages = [...prev];
                                    setIsThinking(true);
                                    setThinkingContent('');
                                    currentAssistantThinking = '';
                                    const lastMessage = newMessages[newMessages.length - 1];
                                    const needsNewMessage = assistantMessageIndex === -1 || (lastMessage && (lastMessage.role === 'tool' || lastMessage.role === 'tool_code'));
                                    if (needsNewMessage) {
                                        assistantMessageIndex = newMessages.length;
                                        // Make sure thinking is defined (empty string, not undefined)
                                        newMessages.push({ role: 'assistant', content: '', thinking: '' });
                                    } else {
                                        const currentMsg = newMessages[assistantMessageIndex];
                                        if (currentMsg) newMessages[assistantMessageIndex] = { ...currentMsg, thinking: '' };
                                    }
                                    return newMessages;
                                });
                                break;

                              case 'THINKING_DELTA':
                                  currentAssistantThinking += event.content;
                                  setThinkingContent(prev => (prev || '') + event.content);
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      if (assistantMessageIndex >= 0 && assistantMessageIndex < newMessages.length) {
                                          newMessages[assistantMessageIndex] = { ...newMessages[assistantMessageIndex], thinking: currentAssistantThinking };
                                      }
                                      return newMessages;
                                  });
                                  break;
                              case 'THINKING_END':
                                  setIsThinking(false);
                                  break;
                              case 'ASSISTANT_START':
                                setMessages(prev => {
                                    console.log('[CLIENT-STATE] setMessages for ASSISTANT_START. Prev length:', prev.length);
                                    const newMessages = [...prev];
                                    if (assistantMessageIndex === -1) {
                                        assistantMessageIndex = newMessages.length;
                                        newMessages.push({ role: 'assistant', content: '', thinking: currentAssistantThinking || undefined });
                                    }
                                    return newMessages;
                                });
                                break;
                              case 'ASSISTANT_DELTA':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      if (assistantMessageIndex === -1) {
                                          assistantMessageIndex = newMessages.length;
                                          newMessages.push({ role: 'assistant', content: '', thinking: currentAssistantThinking || undefined });
                                      }
                                      if (assistantMessageIndex >= 0 && assistantMessageIndex < newMessages.length) {
                                          newMessages[assistantMessageIndex] = { ...newMessages[assistantMessageIndex], content: (newMessages[assistantMessageIndex].content || '') + event.content, thinking: currentAssistantThinking || newMessages[assistantMessageIndex].thinking };
                                      }
                                      return newMessages;
                                  });
                                  break;
                              case 'ASSISTANT_COMPLETE':
                                  if (event.thinking !== undefined) {
                                      setMessages(prev => {
                                          const newMessages = [...prev];
                                          if (assistantMessageIndex >= 0 && assistantMessageIndex < newMessages.length) {
                                              newMessages[assistantMessageIndex] = { ...newMessages[assistantMessageIndex], thinking: event.thinking || undefined };
                                          }
                                          return newMessages;
                                      });
                                  }
                                  currentAssistantThinking = '';
                                  break;
                              case 'TOOL_CODE_CREATE':
                                assistantMessageIndex = -1;
                                setMessages(prev => [...prev, event.message]);
                                break;
                              case 'TOOL_CODE_DELTA':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const toolIndex = newMessages.findIndex(m => m.tool_id === event.tool_id);
                                      if (toolIndex !== -1) newMessages[toolIndex] = { ...newMessages[toolIndex], content: (newMessages[toolIndex].content || '') + event.content };
                                      return newMessages;
                                  });
                                  break;
                              case 'TOOL_CODE_COMPLETE':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const toolIndex = newMessages.findIndex(m => m.tool_id === event.tool_id);
                                      if (toolIndex !== -1) newMessages[toolIndex].state = 'ready_to_execute';
                                      return newMessages;
                                  });
                                  break;
                              case 'TOOL_CODE_STATE_UPDATE':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const toolIndex = newMessages.findIndex(m => m.tool_id === event.tool_id);
                                      if (toolIndex !== -1) newMessages[toolIndex].state = event.state;
                                      return newMessages;
                                  });
                                  break;
                              case 'TOOL_RESULT':
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const toolCodeIndex = newMessages.findIndex(m => m.role === 'tool_code' && m.tool_id === event.tool_id);
                                    if (toolCodeIndex !== -1) newMessages[toolCodeIndex].state = event.state;
                                    newMessages.push({ role: 'tool', content: event.result.content, tool_id: event.tool_id, fileOutput: event.result.fileOutput || undefined });
                                    return newMessages;
                                });
                                assistantMessageIndex = -1;
                                break;
                          }
                      } catch (error) {
                          console.error("[CLIENT] SSE Parse Error:", { jsonString, error });
                      }
                  }
                  boundary = buffer.indexOf('\n\n');
              }
          }
      } catch (error) {
          console.error("%c[CLIENT] Stream Error", 'color: red; font-weight: bold;', error);
          showNotification(error instanceof Error ? error.message : "Failed to get response.", "error");
          setMessages(messageHistory);
      } finally {
          console.log('%c[CLIENT] Stream Finally Block', 'color: blue; font-weight: bold;');
          setIsStreaming(false);
          setIsThinking(false);
          setThinkingContent(null);
          await loadChatList();
      }
  };

  const sendMessage = async (text: string, attachments: Attachment[] = [], metadata?: Record<string, any>) => {
    if (isStreaming || isSending) return;
    const userMessage: Message = { role: 'user', content: text, attachments };
    const originalMessages = messages;
    setIsSending(true);

    try {
      if (!activeChatId) {
        setIsCreatingChat(true);
        const initialMessages = [userMessage];
        const createChatResponse = await api('/chats', { method: 'POST', body: JSON.stringify({ messages: initialMessages }) });
        if (!createChatResponse.ok) {
            const errorData = await createChatResponse.json();
            throw new Error(errorData.error || 'Failed to create chat session.');
        }
        const newChat = await createChatResponse.json();
        setActiveChatId(newChat._id);
        navigate(`/c/${newChat._id}`, { replace: true });
        await streamAndSaveResponse(newChat._id, newChat.messages, metadata);
      } else {
        const updatedMessages = [...messages, userMessage];
        await streamAndSaveResponse(activeChatId, updatedMessages, metadata);
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
    setMessages([]); setActiveChatId(null); setEditingIndex(null);
  }, []);

  const startEditing = (index: number) => setEditingIndex(index);
  const cancelEditing = () => setEditingIndex(null);

  const saveAndSubmitEdit = async (index: number, newContent: string) => {
    if (!activeChatId) return;
    const editedHistory = messages.slice(0, index + 1);
    editedHistory[index] = { ...editedHistory[index], content: newContent };
    setEditingIndex(null);
    await streamAndSaveResponse(activeChatId, editedHistory);
  };

  const regenerateResponse = async (metadata?: Record<string, any>) => {
    console.log('%c[CLIENT] Regenerate Clicked', 'color: orange; font-weight: bold;');
    if (!activeChatId || messages.length < 1 || isStreaming || isSending) {
        console.warn('[CLIENT] Regenerate cancelled:', { activeChatId, isStreaming, isSending });
        return;
    }
    
    console.log('[CLIENT] Messages before regeneration:', JSON.parse(JSON.stringify(messages)));
    
    const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIndex === -1) {
        console.error('[CLIENT] Could not find last user message for regeneration.');
        return;
    }
    
    const historyForRegeneration = messages.slice(0, lastUserIndex + 1);
    console.log('[CLIENT] History prepared for regeneration:', JSON.parse(JSON.stringify(historyForRegeneration)));
    
    const regenerationMetadata = { 
      isRegeneration: true, 
      hadCodeExecution: messages.some(m => m.role === 'tool_code'),
      ...metadata 
    };
    
    await streamAndSaveResponse(activeChatId, historyForRegeneration, regenerationMetadata);
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      await api(`/chats/${chatId}`, { method: 'PUT', body: JSON.stringify({ title: newTitle }) });
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
      await api(`/chats/${chatId}`, { method: 'DELETE' });
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
    cancelEditing, saveAndSubmitEdit, regenerateResponse, renameChat, deleteChat,
    isThinking, thinkingContent,
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