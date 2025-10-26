// src/contexts/ChatContext.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useRef,
} from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Message, Attachment } from '../types';
import { useSettings } from './SettingsContext';
import { useNotification } from './NotificationContext';
import api from '../utils/api';
import { fetchPublicConfig } from '../utils/config';

type ChatListItem = {
  _id: string;
  title: string;
  updatedAt: string;
};

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
  sendMessage: (
    text: string,
    attachments: Attachment[],
    metadata?: Record<string, any>
  ) => Promise<void>;
  stopGeneration: () => void;
  isStreaming: boolean;
  isThinking: boolean;
  isThinkingEnabled: boolean;
  toggleThinking: () => void;
  thinkingContent: string | null;
  editingIndex: number | null;
  startEditing: (index: number) => void;
  cancelEditing: () => void;
  saveAndSubmitEdit: (
    index: number,
    newContent: string,
    metadata?: Record<string, any>
  ) => Promise<void>;
  regenerateResponse: (metadata?: Record<string, any>) => Promise<void>;
  renameChat: (chatId: string, newTitle: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearAllChats: () => Promise<void>;
  sendGeolocationResult: (
    chatId: string,
    tool_id: string,
    result:
      | { coordinates: { latitude: number; longitude: number } }
      | { error: string }
  ) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const DEBUG_LOCAL = import.meta.env.VITE_API_URL === 'http://localhost:3001';
  const navigate = useNavigate();
  const { token, selectedModel, user } = useSettings();
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
  const [reasoningModels, setReasoningModels] = useState<string[]>([]);

  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const toggleThinking = () => setThinkingEnabled((prev) => !prev);

  // Fetch reasoning models from server config
  useEffect(() => {
    const fetchReasoningModels = async () => {
      try {
        console.log(import.meta.env.VITE_API_URL)
        const response = import.meta.env.VITE_API_URL || await fetchPublicConfig();
        if (response.ok) {
          const config = await response.json();
          if (config.reasoningModels && Array.isArray(config.reasoningModels)) {
            setReasoningModels(config.reasoningModels);
            console.log('[ChatContext] Loaded reasoning models from server:', config.reasoningModels);
          }
        }
      } catch (error) {
        console.error('[ChatContext] Failed to fetch reasoning models:', error);
        // Fallback to defaults if fetch fails
        setReasoningModels([
          'thinking', 'reasoning', 'o1', 'o3', 'deepseek-reasoner',
          'qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-vl-plus', 'qwen-vl-max',
          'qwen2.5', 'qwen-qwq', 'claude-3-7-sonnet', 'gemini-2.5'
        ]);
      }
    };
    fetchReasoningModels();
  }, []);

  // Auto-enable thinking for reasoning models
  useEffect(() => {
    const modelName = selectedModel?.toLowerCase() || '';
    const provider = user?.selectedProvider?.toLowerCase() || '';
    console.log('[ChatContext] Checking model for auto-enable thinking:', modelName, 'provider:', provider);
    
    // Enable thinking for default provider or if model name matches reasoning patterns
    const isReasoningModel = 
      provider === 'default' ||  // Default provider uses Gemini 2.5 Flash
      reasoningModels.some(pattern => modelName.includes(pattern.toLowerCase()));
    
    console.log('[ChatContext] Is reasoning model?', isReasoningModel, '-> setting isThinkingEnabled to', isReasoningModel);
    setThinkingEnabled(isReasoningModel);
  }, [selectedModel, user?.selectedProvider, reasoningModels]);

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
      showNotification('Could not load chat history.', 'error');
    } finally {
      setIsLoadingChatList(false);
    }
  }, [token, showNotification]);

  useEffect(() => {
    loadChatList();
  }, [loadChatList]);

  const stopGeneration = useCallback(() => {
    if (DEBUG_LOCAL) {
      // eslint-disable-next-line no-console
      console.debug('[DEBUG STREAM] stopGeneration called. Aborting stream and clearing waiting states.');
    }
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setIsThinking(false);
    setThinkingContent(null);
    setMessages((prev) => prev.filter((m) => !m.isWaiting));
    setIsSending(false);
    streamAbortControllerRef.current = null;
  }, []);

  const streamAndSaveResponse = useCallback(
    async (
      chatId: string,
      messageHistory: Message[],
      metadata?: Record<string, any>
    ) => {
      

  setIsSending(true);
      setIsStreaming(true);
      setIsThinking(false);
      setThinkingContent(null);

      streamAbortControllerRef.current = new AbortController();
      let currentAssistantThinking = '';
      let assistantMessageIndex = -1;
      let streamEndedForClientTool = false;

      try {
        if (DEBUG_LOCAL) {
          // eslint-disable-next-line no-console
          console.debug('[DEBUG STREAM] → POST /chats/%s/stream', chatId, {
            historyLen: messageHistory.length,
            lastRole: messageHistory[messageHistory.length - 1]?.role,
            meta: metadata,
          });
        }

        const response = await api(`/chats/${chatId}/stream`, {
          method: 'POST',
          body: JSON.stringify({ messagesFromClient: messageHistory, metadata }),
          signal: streamAbortControllerRef.current.signal,
        });

        if (!response.ok) {
          if (DEBUG_LOCAL) {
            // eslint-disable-next-line no-console
            console.debug('[DEBUG STREAM] HTTP error from /stream:', response.status, response.statusText);
          }
          const errorData = await response
            .json()
            .catch(() => ({ error: 'Streaming failed with status ' + response.status }));
          throw new Error(errorData.error);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('Failed to read stream.');

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
              if (!line.startsWith('data: ')) continue;
              const jsonString = line.substring(6).trim();
              if (jsonString === '{"type":"done"}' || !jsonString) continue;

              try {
                const event = JSON.parse(jsonString);
                if (DEBUG_LOCAL) {
                  const t = event?.type;
                  // Avoid noisy logs for token deltas; summarize instead
                  if (t === 'ASSISTANT_DELTA' || t === 'TOOL_CODE_DELTA' || t === 'TOOL_SEARCH_DELTA' || t === 'TOOL_DOC_EXTRACT_DELTA' || t === 'TOOL_INTEGRATION_DELTA' || t === 'THINKING_DELTA') {
                    // eslint-disable-next-line no-console
                    console.debug('[DEBUG SSE] Δ', t, (event.content ? `len=${event.content.length}` : '')); 
                  } else {
                    // eslint-disable-next-line no-console
                    console.debug('[DEBUG SSE] evt', t, { tool_id: event.tool_id, state: event.state, reason: event.reason });
                  }
                }

                if (event.type === 'error') {
                  const errorMessage =
                    event.error?.message ||
                    (typeof event.error === 'string'
                      ? event.error
                      : 'An unknown error occurred on the server.');
                  throw new Error(errorMessage);
                }

                if (event.type === 'STREAM_END' && event.reason === 'tool_use') {
                  streamEndedForClientTool = true;
                  if (DEBUG_LOCAL) {
                    // eslint-disable-next-line no-console
                    console.debug('[DEBUG STREAM] STREAM_END for client-side tool, pausing stream.');
                  }
                  continue;
                }

                switch (event.type) {
                  case 'THINKING_START':
                    console.log('[DEBUG THINKING] Received THINKING_START event');
                    setIsThinking(true);
                    setThinkingContent('');
                    currentAssistantThinking = '';

                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];

                      if (lastMessage?.isWaiting) {
                        assistantMessageIndex = newMessages.length - 1;
                        newMessages[assistantMessageIndex] = {
                          role: 'assistant',
                          content: '',
                          thinking: '',
                        };
                      } else {
                        const needsNewMessage =
                          assistantMessageIndex === -1 ||
                          (lastMessage &&
                            (lastMessage.role !== 'assistant' ||
                              (lastMessage.content && lastMessage.content.trim() !== '')));
                        if (needsNewMessage) {
                          assistantMessageIndex = newMessages.length;
                          newMessages.push({ role: 'assistant', content: '', thinking: '' });
                        } else {
                          const currentMsg = newMessages[assistantMessageIndex];
                          if (currentMsg)
                            newMessages[assistantMessageIndex] = { ...currentMsg, thinking: '' };
                        }
                      }
                      return newMessages;
                    });
                    break;

                  case 'THINKING_DELTA':
                    console.log('[DEBUG THINKING] Received THINKING_DELTA, length:', event.content?.length);
                    currentAssistantThinking += event.content;
                    setThinkingContent((prev) => (prev || '') + event.content);
                    flushSync(() => {
                      setMessages((prev) => {
                        const newMessages = [...prev];
                        if (assistantMessageIndex === -1) {
                          const lastMessage = newMessages[newMessages.length - 1];
                          if (lastMessage?.role === 'assistant') {
                            assistantMessageIndex = newMessages.length - 1;
                          } else {
                            assistantMessageIndex = newMessages.length;
                            newMessages.push({ role: 'assistant', content: '', thinking: '' });
                          }
                        } else if (assistantMessageIndex >= newMessages.length) {
                          assistantMessageIndex = newMessages.length;
                          newMessages.push({ role: 'assistant', content: '', thinking: '' });
                        }
                        if (
                          assistantMessageIndex >= 0 &&
                          assistantMessageIndex < newMessages.length
                        ) {
                          const currentMsg = newMessages[assistantMessageIndex];
                          newMessages[assistantMessageIndex] = {
                            ...currentMsg,
                            thinking: currentAssistantThinking,
                          };
                        }
                        return newMessages;
                      });
                    });
                    break;

                  case 'THINKING_END':
                    console.log('[DEBUG THINKING] Received THINKING_END, total thinking content length:', currentAssistantThinking.length);
                    setIsThinking(false);
                    break;

                  case 'ASSISTANT_START':
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];

                      if (lastMessage?.isWaiting) {
                        assistantMessageIndex = newMessages.length - 1;
                        newMessages[assistantMessageIndex] = {
                          role: 'assistant',
                          content: '',
                          thinking: currentAssistantThinking || undefined,
                        };
                      } else if (
                        assistantMessageIndex === -1 ||
                        (lastMessage && lastMessage.role !== 'assistant')
                      ) {
                        assistantMessageIndex = newMessages.length;
                        newMessages.push({
                          role: 'assistant',
                          content: '',
                          thinking: currentAssistantThinking || undefined,
                        });
                      }
                      return newMessages;
                    });
                    break;

                  case 'ASSISTANT_DELTA':
                    flushSync(() => {
                      setMessages((prev) => {
                        const newMessages = [...prev];
                        if (assistantMessageIndex === -1 || assistantMessageIndex >= newMessages.length) {
                          assistantMessageIndex = newMessages.length;
                          newMessages.push({
                            role: 'assistant',
                            content: '',
                            thinking: currentAssistantThinking || undefined,
                          });
                        }
                        const currentMsg = newMessages[assistantMessageIndex];
                        if (currentMsg && currentMsg.role === 'assistant') {
                          const newContent = (currentMsg.content || '') + event.content;
                          newMessages[assistantMessageIndex] = {
                            ...currentMsg,
                            content: newContent,
                            thinking: currentAssistantThinking || currentMsg.thinking,
                          };
                        }
                        return newMessages;
                      });
                    });
                    break;

                  case 'USER_MESSAGE_ACK':
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const lastUserMessageIndex = newMessages.findLastIndex((m) => m.role === 'user');
                      if (lastUserMessageIndex !== -1) {
                        newMessages[lastUserMessageIndex] = event.message;
                      }
                      return newMessages;
                    });
                    break;

                  case 'ASSISTANT_COMPLETE':
                    if (DEBUG_LOCAL) {
                      // eslint-disable-next-line no-console
                      console.debug('[DEBUG SSE] ASSISTANT_COMPLETE');
                    }
                    break;

                  case 'TOOL_CODE_CREATE':
                  case 'TOOL_SEARCH_CREATE':
                  case 'TOOL_DOC_EXTRACT_CREATE':
                  case 'TOOL_GEOLOCATION_CREATE':
                  case 'TOOL_INTEGRATION_CREATE': // ADDED
                    if (event.message && event.message.isClientSideTool) {
                      streamEndedForClientTool = true;
                    }
                    setMessages((prev) => {

                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage?.isWaiting) {
                        newMessages[newMessages.length - 1] = event.message;
                      } else {
                        newMessages.push(event.message);
                      }
                      return newMessages;
                    });
                    break;

                  case 'TOOL_CODE_DELTA':
                  case 'TOOL_SEARCH_DELTA':
                  case 'TOOL_DOC_EXTRACT_DELTA':
                  case 'TOOL_INTEGRATION_DELTA': // ADDED
                    flushSync(() => {
                      setMessages((prev) => {
                        const newMessages = [...prev];
                        const toolIndex = newMessages.findIndex((m) => m.tool_id === event.tool_id);
                        if (toolIndex !== -1) {
                          newMessages[toolIndex] = {
                            ...newMessages[toolIndex],
                            content: (newMessages[toolIndex].content || '') + event.content,
                          };
                        }
                        return newMessages;
                      });
                    });
                    break;

                  case 'TOOL_CODE_COMPLETE':
                  case 'TOOL_SEARCH_COMPLETE':
                  case 'TOOL_DOC_EXTRACT_COMPLETE':
                  case 'TOOL_INTEGRATION_COMPLETE': // ADDED
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const toolIndex = newMessages.findIndex((m) => m.tool_id === event.tool_id);
                      if (toolIndex !== -1) newMessages[toolIndex].state = 'ready_to_execute';
                      return newMessages;
                    });
                    break;

                  case 'TOOL_CODE_STATE_UPDATE':
                  case 'TOOL_SEARCH_STATE_UPDATE':
                  case 'TOOL_DOC_EXTRACT_STATE_UPDATE':
                  case 'TOOL_INTEGRATION_STATE_UPDATE': // ADDED
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const toolIndex = newMessages.findIndex((m) => m.tool_id === event.tool_id);
                      if (toolIndex !== -1) newMessages[toolIndex].state = event.state;
                      return newMessages;
                    });
                    break;

                  case 'TOOL_CODE_RESULT':
                  case 'TOOL_SEARCH_RESULT':
                  case 'TOOL_DOC_EXTRACT_RESULT':
                  case 'TOOL_INTEGRATION_RESULT': // ADDED
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const toolReqRole = event.type.replace('_RESULT', '').toLowerCase();
                        const toolIndex = newMessages.findIndex(
                            (m) => m.role === toolReqRole && m.tool_id === event.tool_id
                        );
                        if (toolIndex !== -1) newMessages[toolIndex].state = event.state;
                        const resultRole = (toolReqRole + '_result') as Message['role'];
                        newMessages.push({
                            role: resultRole,
                            content: event.result.content,
                            tool_id: event.tool_id,
                            fileOutputs: event.result.fileOutputs || undefined,
                            integrationData: event.result.integrationData || undefined,
                        });
                        return newMessages;
                    });
                    assistantMessageIndex = -1;
                    currentAssistantThinking = '';
                    break;
                }
              } catch (error) {
                const errorMessage = JSON.parse(jsonString)?.error?.message;
                if (DEBUG_LOCAL) {
                  // eslint-disable-next-line no-console
                  console.debug('[DEBUG SSE] parse-error for event JSON:', jsonString);
                }
                throw new Error(`Received error from the server.\n${errorMessage}`);
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } catch (error) {
        if (DEBUG_LOCAL) {
          // eslint-disable-next-line no-console
          console.debug('[DEBUG STREAM] caught error:', error);
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (activeChatId) {
            const finalMessages = messagesRef.current.filter((m) => !m.isWaiting);
            try {
              await api(`/chats/${activeChatId}`, {
                method: 'PUT',
                body: JSON.stringify({ messages: finalMessages }),
              });
            } catch (saveError) {
              showNotification('Could not save the partial response.', 'error');
            }
          }
        } else {
          showNotification(
            error instanceof Error ? error.message : 'Failed to get response.',
            'error'
          );
        }
      } finally {
        if (streamEndedForClientTool) {
          setIsStreaming(false);
          streamAbortControllerRef.current = null;
          if (DEBUG_LOCAL) {
            // eslint-disable-next-line no-console
            console.debug('[DEBUG STREAM] Finalized after client-side tool.');
          }
        } else {
          stopGeneration();
          if (DEBUG_LOCAL) {
            // eslint-disable-next-line no-console
            console.debug('[DEBUG STREAM] stopGeneration called from finally.');
          }
        }
      }
    },
    [stopGeneration, showNotification]
  );

  const sendMessage = async (
    text: string,
    attachments: Attachment[] = [],
    metadata?: Record<string, any>
  ) => {
    if (isStreaming || isSending) return;
    if (DEBUG_LOCAL) {
      // eslint-disable-next-line no-console
      console.debug('[DEBUG SEND] sendMessage', { hasAttachments: attachments.length > 0, textLen: text?.length, meta: metadata });
    }
    const userMessage: Message = { role: 'user', content: text, attachments };

    // --- START OF FIX ---
    // Use messagesRef to get the most current state for the API call
    const currentMessages = messagesRef.current;
    const originalMessages = currentMessages; // Store for potential rollback
    // --- END OF FIX ---

    try {
      if (!activeChatId) {
        setIsCreatingChat(true);
        const initialMessages = [userMessage];
        const createChatResponse = await api('/chats', {
          method: 'POST',
          body: JSON.stringify({ messages: initialMessages }),
        });
        if (!createChatResponse.ok) {
          const errorData = await createChatResponse.json();
          throw new Error(errorData.error || 'Failed to create chat session.');
        }
        const newChat = await createChatResponse.json();
        setActiveChatId(newChat._id);
        navigate(`/app/c/${newChat._id}`, { replace: true });

        const messagesWithPlaceholder = [
          ...newChat.messages,
          { role: 'assistant', content: '', isWaiting: true } as Message,
        ];
        setMessages(messagesWithPlaceholder);

        const streamMetadata = { ...metadata, isThinkingEnabled, userMessageAlreadySaved: true };
        console.log('[DEBUG THINKING] streamMetadata for new chat:', streamMetadata);
        await streamAndSaveResponse(newChat._id, newChat.messages, streamMetadata);        await loadChatList();
      } else {
        // --- START OF FIX ---
        const updatedMessages = [...currentMessages, userMessage];
        // --- END OF FIX ---
        const messagesWithPlaceholder = [
          ...updatedMessages,
          { role: 'assistant', content: '', isWaiting: true } as Message,
        ];
        setMessages(messagesWithPlaceholder);
        console.log('[DEBUG THINKING] streamMetadata for existing chat:', { ...metadata, isThinkingEnabled });
        await streamAndSaveResponse(activeChatId, updatedMessages, metadata);
      }
    } catch (error) {
      if (DEBUG_LOCAL) {
        // eslint-disable-next-line no-console
        console.debug('[DEBUG SEND] sendMessage error:', error);
      }
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        showNotification(error instanceof Error ? error.message : 'Could not send message.', 'error');
      }
      if (activeChatId) {
        setMessages(originalMessages);
      } else {
        setMessages([]);
        setActiveChatId(null);
        navigate('/', { replace: true });
      }
    } finally {
      setIsCreatingChat(false);
    }
  };

  const sendGeolocationResult = useCallback(
    async (
      chatId: string,
      tool_id: string,
      result:
        | { coordinates: { latitude: number; longitude: number } }
        | { error: string }
    ) => {
      if (isStreaming) {
        
        return;
      }

      let result_content: string;
      if ('coordinates' in result) {
        result_content = `User's location is latitude ${result.coordinates.latitude.toFixed(
          6
        )}, longitude ${result.coordinates.longitude.toFixed(6)}.`;
      } else {
        result_content = `Could not get user's location. Error: ${result.error}`;
      }
      

      // --- START OF FIX ---
      // Get the most up-to-date messages from the ref, which is always current.
      const currentMessages = messagesRef.current;
      const cleanMessages = currentMessages.filter((m) => !m.isWaiting);
      // --- END OF FIX ---

      const originalToolMsg = cleanMessages.find(
        (m) => m.tool_id === tool_id && m.role === 'tool_geolocation'
      );
      if (!originalToolMsg) {
        showNotification('An error occurred. Please try again.', 'error');
        return;
      }

      const resultMessage: Message = {
        role: 'tool_geolocation_result',
        tool_id: tool_id,
        tool_name: originalToolMsg.tool_name,
        content: result_content,
      };

      const messagesForUI = cleanMessages.map((m) =>
        m.tool_id === tool_id
          ? ({ ...m, state: 'error' in result ? 'error' : 'completed' } as Message)
          : m
      );

      const historyForBackend = [...messagesForUI, resultMessage];

      

      setMessages([...messagesForUI, { role: 'assistant', content: '', isWaiting: true }]);
      await streamAndSaveResponse(chatId, historyForBackend, { isContinuation: true });
    },
    [isStreaming, streamAndSaveResponse, showNotification]
  );

  const loadChat = useCallback(
    async (id: string) => {
      setIsLoadingChat(true);
      try {
        const response = await api(`/chats/${id}`);
        if (!response.ok) throw new Error('Chat not found');
        const data = await response.json();
        setMessages(data.messages);
        setActiveChatId(data._id);
      } catch (error) {
        showNotification('Could not load chat.', 'error');
        navigate('/', { replace: true });
      } finally {
        setIsLoadingChat(false);
      }
    },
    [navigate, showNotification]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setActiveChatId(null);
    setEditingIndex(null);
  }, []);

  const startEditing = (index: number) => setEditingIndex(index);
  const cancelEditing = () => setEditingIndex(null);

  const saveAndSubmitEdit = async (index: number, newContent: string) => {
    if (!activeChatId) return;
    stopGeneration();

    // --- START OF FIX ---
    const historyUpToEdit = messagesRef.current.slice(0, index);
    // --- END OF FIX ---
    const updatedUserMessage: Message = { ...messages[index], content: newContent };
    const newHistoryForStream = [...historyUpToEdit, updatedUserMessage];
    const messagesForUi = [
      ...newHistoryForStream,
      { role: 'assistant', content: '', isWaiting: true } as Message,
    ];

    setMessages(messagesForUi);
    setEditingIndex(null);

    await streamAndSaveResponse(activeChatId, newHistoryForStream, {
      isRegeneration: true,
      isThinkingEnabled: isThinkingEnabled,
    });
  };

  const regenerateResponse = async (metadata?: Record<string, any>) => {
    if (!activeChatId || isStreaming || isSending) return;
    if (DEBUG_LOCAL) {
      // eslint-disable-next-line no-console
      console.debug('[DEBUG REGEN] regenerateResponse triggered');
    }

    // --- START OF FIX ---
    const currentMessages = messagesRef.current;
    const lastUserIndex = currentMessages.findLastIndex((m) => m.role === 'user');
    if (lastUserIndex === -1) return;
    const historyForRegeneration = currentMessages.slice(0, lastUserIndex + 1);
    // --- END OF FIX ---

    const regenerationMetadata = { isRegeneration: true, ...metadata, isThinkingEnabled };
    const messagesWithPlaceholder = [
      ...historyForRegeneration,
      { role: 'assistant', content: '', isWaiting: true } as Message,
    ];
    setMessages(messagesWithPlaceholder);

    await streamAndSaveResponse(activeChatId, historyForRegeneration, regenerationMetadata);
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      await api(`/chats/${chatId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: newTitle }),
      });
      await loadChatList();
      showNotification('Chat renamed!', 'success');
    } catch (error) {
      showNotification('Could not rename chat.', 'error');
      throw error;
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      await api(`/chats/${chatId}`, { method: 'DELETE' });
      setChatList((prev) => prev.filter((c) => c._id !== chatId));
      if (activeChatId === chatId) {
        navigate('/', { replace: true });
        clearChat();
      }
      showNotification('Chat deleted.', 'success');
    } catch (error) {
      showNotification('Could not delete chat.', 'error');
      throw error;
    }
  };

  const clearAllChats = async () => {
    try {
      await api('/chats/all', { method: 'DELETE' });
      setChatList([]);
      clearChat();
      showNotification('All conversations cleared.', 'success');
    } catch (error) {
      showNotification('Could not clear conversations.', 'error');
      throw error;
    }
  };

  const value = {
    messages,
    chatList,
    activeChatId,
    loadChat,
    clearChat,
    isLoadingChat,
    isLoadingChatList,
    isCreatingChat,
    isSending,
    sendMessage,
    isStreaming,
    editingIndex,
    startEditing,
    cancelEditing,
    saveAndSubmitEdit,
    regenerateResponse,
    renameChat,
    isThinking,
    thinkingContent,
    isThinkingEnabled,
    toggleThinking,
    stopGeneration,
    deleteChat,
    clearAllChats,
    sendGeolocationResult,
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