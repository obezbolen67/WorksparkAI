// src/contexts/ChatContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
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
  isLoadingChatList: boolean; 
  isCreatingChat: boolean;
  isSending: boolean;
  sendMessage: (text: string, attachments: Attachment[], metadata?: Record<string, any>) => Promise<void>;
  stopGeneration: () => void;
  isStreaming: boolean;
  isThinking: boolean;
  isThinkingEnabled: boolean;
  toggleThinking: () => void;
  thinkingContent: string | null;
  editingIndex: number | null;
  startEditing: (index: number) => void;
  cancelEditing: () => void;
  saveAndSubmitEdit: (index: number, newContent: string, metadata?: Record<string, any>) => Promise<void>;
  regenerateResponse: (metadata?: Record<string, any>) => Promise<void>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearAllChats: () => Promise<void>;
  sendGeolocationResult: (chatId: string, tool_id: string, result: { coordinates: { latitude: number; longitude: number; } } | { error: string }) => Promise<void>;
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
  const [isLoadingChatList, setIsLoadingChatList] = useState(true); 
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState<string | null>(null);
  const [isThinkingEnabled, setThinkingEnabled] = useState(false);
  const toggleThinking = () => setThinkingEnabled(prev => !prev);

  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadChatList = useCallback(async () => {
    if (!token) {
      setIsLoadingChatList(false); 
      return;
    }
    setIsLoadingChatList(true); 
    try {
      const response = await api('/chats');
      if (!response.ok) throw new Error('Failed to fetch chat list');
      const data = await response.json();
      setChatList(data);
    } catch (error) {
      console.error(error);
      showNotification('Could not load chat history.', 'error');
    } finally {
      setIsLoadingChatList(false); 
    }
  }, [token, showNotification]);

  useEffect(() => {
    loadChatList();
  }, [loadChatList]);
  
  // --- START OF FIX: Stabilize cleanup function with useCallback ---
  const stopGeneration = useCallback(() => {
    if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort();
    }
    // This is the primary cleanup function now
    setIsStreaming(false);
    setIsThinking(false);
    setThinkingContent(null);
    setMessages(prev => prev.filter(m => !m.isWaiting));
    setIsSending(false);
    streamAbortControllerRef.current = null;
  }, []);
  // --- END OF FIX ---

  // --- START OF FIX: Stabilize stream function with useCallback ---
  const streamAndSaveResponse = useCallback(async (
      chatId: string,
      messageHistory: Message[], 
      metadata?: Record<string, any>
  ) => {
      setIsSending(true)
      setIsStreaming(true);
      setIsThinking(false);
      setThinkingContent(null);
    
      streamAbortControllerRef.current = new AbortController();
      let currentAssistantThinking = '';
      let assistantMessageIndex = -1;
      let streamEndedForClientTool = false;

      try {
          const response = await api(`/chats/${chatId}/stream`, {
              method: 'POST',
              body: JSON.stringify({ messagesFromClient: messageHistory, metadata }),
              signal: streamAbortControllerRef.current.signal,
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
              if (done) break

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
                          
                          if (event.type === 'error') {
                            const errorMessage = event.error?.message || (typeof event.error === 'string' ? event.error : "An unknown error occurred on the server.");
                            throw new Error(errorMessage);
                          }
                          
                          if (event.type === 'STREAM_END' && event.reason === 'tool_use') {
                            streamEndedForClientTool = true;
                            continue;
                          }
                          switch (event.type) {
                              case 'THINKING_START':
                                setIsThinking(true);
                                setThinkingContent('');
                                currentAssistantThinking = '';
                                
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMessage = newMessages[newMessages.length - 1];
                                    
                                    if (lastMessage?.isWaiting) {
                                        assistantMessageIndex = newMessages.length - 1;
                                        newMessages[assistantMessageIndex] = { role: 'assistant', content: '', thinking: '' };
                                    } else {
                                        const needsNewMessage = assistantMessageIndex === -1 || (lastMessage && (lastMessage.role !== 'assistant' || (lastMessage.content && lastMessage.content.trim() !== '')));
                                        if (needsNewMessage) {
                                            assistantMessageIndex = newMessages.length;
                                            newMessages.push({ role: 'assistant', content: '', thinking: '' });
                                        } else {
                                            const currentMsg = newMessages[assistantMessageIndex];
                                            if (currentMsg) newMessages[assistantMessageIndex] = { ...currentMsg, thinking: '' };
                                        }
                                    }
                                    return newMessages;
                                });
                                break;
                              
                              case 'THINKING_DELTA':
                                currentAssistantThinking += event.content;
                                setThinkingContent(prev => (prev || '') + event.content);
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    if (assistantMessageIndex === -1) {
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage?.role === 'assistant') {
                                            assistantMessageIndex = newMessages.length - 1;
                                        } else {
                                            assistantMessageIndex = newMessages.length;
                                            newMessages.push({ role: 'assistant', content: '', thinking: ''});
                                        }
                                    } else if (assistantMessageIndex >= newMessages.length) {
                                        assistantMessageIndex = newMessages.length;
                                        newMessages.push({ role: 'assistant', content: '', thinking: ''});
                                    }
                                    if (assistantMessageIndex >= 0 && assistantMessageIndex < newMessages.length) {
                                        const currentMsg = newMessages[assistantMessageIndex];
                                        newMessages[assistantMessageIndex] = { ...currentMsg, thinking: currentAssistantThinking };
                                    }
                                    return newMessages;
                                });
                                break;

                              case 'THINKING_END':
                                  setIsThinking(false);
                                  break;
                              case 'ASSISTANT_START':
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMessage = newMessages[newMessages.length - 1];

                                    if (lastMessage?.isWaiting) {
                                      assistantMessageIndex = newMessages.length - 1;
                                      newMessages[assistantMessageIndex] = { role: 'assistant', content: '', thinking: currentAssistantThinking || undefined };
                                    } else if (assistantMessageIndex === -1 || (lastMessage && (lastMessage.role !== 'assistant'))) {
                                        assistantMessageIndex = newMessages.length;
                                        newMessages.push({ role: 'assistant', content: '', thinking: currentAssistantThinking || undefined });
                                    }
                                    return newMessages;
                                });
                                break;
                              case 'ASSISTANT_DELTA':
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    if (assistantMessageIndex === -1 || assistantMessageIndex >= newMessages.length) {
                                        assistantMessageIndex = newMessages.length;
                                        newMessages.push({ role: 'assistant', content: '', thinking: currentAssistantThinking || undefined });
                                    }
                                    const currentMsg = newMessages[assistantMessageIndex];
                                    if (currentMsg && currentMsg.role === 'assistant') {
                                        const newContent = (currentMsg.content || '') + event.content;
                                        newMessages[assistantMessageIndex] = { ...currentMsg, content: newContent, thinking: currentAssistantThinking || currentMsg.thinking };
                                    }
                                    return newMessages;
                                });
                                break;
                              
                              case 'USER_MESSAGE_ACK':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const lastUserMessageIndex = newMessages.findLastIndex(m => m.role === 'user');
                                      if (lastUserMessageIndex !== -1) {
                                          newMessages[lastUserMessageIndex] = event.message;
                                      }
                                      return newMessages;
                                  });
                                  break;
                              case 'ASSISTANT_COMPLETE':
                                  break;
                              
                              case 'TOOL_CODE_CREATE':
                              case 'TOOL_SEARCH_CREATE':
                              case 'TOOL_DOC_EXTRACT_CREATE':
                              case 'TOOL_GEOLOCATION_CREATE':
                                if (event.message.isClientSideTool) {
                                  streamEndedForClientTool = true;
                                }
                                setMessages(prev => {
                                  const newMessages = [...prev];
                                  const lastMessage = newMessages[newMessages.length - 1];
                                  if (lastMessage?.isWaiting) {
                                    newMessages[newMessages.length - 1] = event.message;
                                  } else  {
                                    newMessages.push(event.message);
                                  }
                                  return newMessages;
                                });
                                break;

                              case 'TOOL_CODE_DELTA':
                              case 'TOOL_SEARCH_DELTA':
                              case 'TOOL_DOC_EXTRACT_DELTA':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const toolIndex = newMessages.findIndex(m => m.tool_id === event.tool_id);
                                      if (toolIndex !== -1) newMessages[toolIndex] = { ...newMessages[toolIndex], content: (newMessages[toolIndex].content || '') + event.content };
                                      return newMessages;
                                  });
                                  break;

                              case 'TOOL_CODE_COMPLETE':
                              case 'TOOL_SEARCH_COMPLETE':
                              case 'TOOL_DOC_EXTRACT_COMPLETE':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const toolIndex = newMessages.findIndex(m => m.tool_id === event.tool_id);
                                      if (toolIndex !== -1) newMessages[toolIndex].state = 'ready_to_execute';
                                      return newMessages;
                                  });
                                  break;

                              case 'TOOL_CODE_STATE_UPDATE':
                              case 'TOOL_SEARCH_STATE_UPDATE':
                              case 'TOOL_DOC_EXTRACT_STATE_UPDATE':
                                  setMessages(prev => {
                                      const newMessages = [...prev];
                                      const toolIndex = newMessages.findIndex(m => m.tool_id === event.tool_id);
                                      if (toolIndex !== -1) newMessages[toolIndex].state = event.state;
                                      return newMessages;
                                  });
                                  break;

                              case 'TOOL_CODE_RESULT':
                              case 'TOOL_SEARCH_RESULT':
                              case 'TOOL_DOC_EXTRACT_RESULT':
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const toolReqRole = event.type.replace('_RESULT', '').toLowerCase();
                                    const toolIndex = newMessages.findIndex(m => m.role === toolReqRole && m.tool_id === event.tool_id);
                                    if (toolIndex !== -1) newMessages[toolIndex].state = event.state;
                                    const resultRole = (toolReqRole + '_result') as Message['role'];
                                    newMessages.push({ 
                                        role: resultRole,
                                        content: event.result.content, 
                                        tool_id: event.tool_id, 
                                        fileOutputs: event.result.fileOutputs || undefined 
                                    });
                                    return newMessages;
                                });
                                assistantMessageIndex = -1;
                                currentAssistantThinking = '';
                                break;
                          }
                      } catch (error) {
                          console.error("[CLIENT] SSE Parse Error:", { jsonString, error });
                          const errorMessage = JSON.parse(jsonString)?.error?.message
                          throw new Error(`Received error from the server.\n${errorMessage}`);
                      }
                  }
                  boundary = buffer.indexOf('\n\n');
              }
        }
      } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
              if (activeChatId) {
                  const finalMessages = messagesRef.current.filter(m => !m.isWaiting);
                  try {
                      await api(`/chats/${activeChatId}`, {
                          method: 'PUT',
                          body: JSON.stringify({ messages: finalMessages }),
                      });
                  } catch (saveError) {
                      console.error('Failed to save chat state on abort:', saveError);
                      showNotification('Could not save the partial response.', 'error');
                  }
              }
          } else {
              console.error("[CLIENT] Stream Error", error);
              showNotification(error instanceof Error ? error.message : "Failed to get response.", "error");
          }
      } finally {
        if (streamEndedForClientTool) {
          setIsStreaming(false);
          streamAbortControllerRef.current = null;
        } else {
          stopGeneration();
        }
      }
  }, [stopGeneration, showNotification]);
  // --- END OF FIX ---

  const sendMessage = async (text: string, attachments: Attachment[] = [], metadata?: Record<string, any>) => {
    if (isStreaming || isSending) return;
    const userMessage: Message = { role: 'user', content: text, attachments };
    const originalMessages = messages;

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
        navigate(`/app/c/${newChat._id}`, { replace: true });
        
        const messagesWithPlaceholder = [...newChat.messages, { role: 'assistant', content: '', isWaiting: true } as Message];
        setMessages(messagesWithPlaceholder); 

        const streamMetadata = {  ...metadata, isThinkingEnabled, userMessageAlreadySaved: true };
        await streamAndSaveResponse(newChat._id, newChat.messages, streamMetadata);

        await loadChatList();

      } else {
        const updatedMessages = [...messages, userMessage];
        const messagesWithPlaceholder = [...updatedMessages, { role: 'assistant', content: '', isWaiting: true } as Message];
        setMessages(messagesWithPlaceholder);
        await streamAndSaveResponse(activeChatId, updatedMessages, metadata);
      }
    } catch (error) {
      console.error(error);
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        showNotification(error instanceof Error ? error.message : 'Could not send message.', 'error');
      }
      if (activeChatId) { setMessages(originalMessages); }
      else { setMessages([]); setActiveChatId(null); navigate('/', { replace: true }); }
    } finally {
      setIsCreatingChat(false);
    }
  };
  
  // --- START OF FIX: Stabilize function and correct guard logic ---
  const sendGeolocationResult = useCallback(async (chatId: string, tool_id: string, result: { coordinates: { latitude: number; longitude: number; } } | { error: string }) => {
    // Only abort if a stream is actively receiving data. 
    // `isSending` is expected to be true in this state.
    if (isStreaming) {
        console.warn('[Geolocation] Aborting sendGeolocationResult because a stream is already in progress.');
        return;
    }
    
    setMessages(currentMessages => {
        const resultMessage: Message = {
          role: 'tool_geolocation_result',
          tool_id: tool_id,
          content: JSON.stringify(result),
        };

        const updatedUIMessages = currentMessages.map(m => 
          m.tool_id === tool_id 
            ? { ...m, state: ('error' in result) ? 'error' : 'completed', content: resultMessage.content } as Message
            : m
        );

        const historyForBackend = [...updatedUIMessages, resultMessage];
        
        Promise.resolve().then(() => {
          streamAndSaveResponse(chatId, historyForBackend, { isContinuation: true });
        });

        return [...updatedUIMessages, { role: 'assistant', content: '', isWaiting: true }];
    });
  }, [isStreaming, streamAndSaveResponse]);
  // --- END OF FIX ---

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
    stopGeneration()

    const historyUpToEdit = messages.slice(0, index);
    const updatedUserMessage: Message = { ...messages[index], content: newContent };
    const newHistoryForStream = [...historyUpToEdit, updatedUserMessage];
    const messagesForUi = [...newHistoryForStream, { role: 'assistant', content: '', isWaiting: true } as Message];
    setMessages(messagesForUi);
    setEditingIndex(null);
    await streamAndSaveResponse(activeChatId, newHistoryForStream, { isRegeneration: true, isThinkingEnabled: isThinkingEnabled });
  };

  const regenerateResponse = async (metadata?: Record<string, any>) => {
    if (!activeChatId || isStreaming || isSending) return;
    const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIndex === -1) return;

    const historyForRegeneration = messages.slice(0, lastUserIndex + 1);
    const regenerationMetadata = { isRegeneration: true, ...metadata, isThinkingEnabled };
    const messagesWithPlaceholder = [...historyForRegeneration, { role: 'assistant', content: '', isWaiting: true } as Message];
    setMessages(messagesWithPlaceholder);
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

  const clearAllChats = async () => {
    try {
      await api('/chats/all', { method: 'DELETE' });
      setChatList([]);
      clearChat();
      showNotification("All conversations cleared.", "success");
    } catch (error) {
      console.error(error);
      showNotification("Could not clear conversations.", "error");
      throw error;
    }
  };

  const value = {
    messages, chatList, activeChatId, loadChat, clearChat, isLoadingChat,
    isLoadingChatList,
    isCreatingChat, isSending, sendMessage, isStreaming, editingIndex, startEditing,
    cancelEditing, saveAndSubmitEdit, regenerateResponse, renameChat,
    isThinking, thinkingContent, isThinkingEnabled, toggleThinking,
    stopGeneration, deleteChat, clearAllChats, sendGeolocationResult
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