// src/pages/ChatPage.tsx

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import ChatView from '../components/ChatView';

const ChatPage = () => {
  const { 
    messages, 
    activeChatId, 
    loadChat, 
    clearChat, 
    isLoadingChat, 
    isCreatingChat,
    isSending,
    sendMessage,
    isStreaming, 
    editingIndex, 
    startEditing, 
    cancelEditing, 
    saveAndSubmitEdit, 
    regenerateResponse,
    // --- REMOVED isThinking and thinkingContent ---
  } = useChat();
  
  const { chatId } = useParams<{ chatId: string }>();

  useEffect(() => {
    if (isCreatingChat) {
      return;
    }
    if (chatId && chatId !== activeChatId) {
      loadChat(chatId);
      return;
    }
    if (!chatId && activeChatId) {
      clearChat();
    }
  }, [chatId, activeChatId, isCreatingChat, loadChat, clearChat]);

  return (
    <ChatView 
      messages={messages}
      activeChatId={activeChatId}
      isStreaming={isStreaming}
      isLoading={isLoadingChat}
      isSending={isSending}
      onSendMessage={sendMessage}
      editingIndex={editingIndex}
      onStartEdit={startEditing}
      onCancelEdit={cancelEditing}
      onSaveEdit={saveAndSubmitEdit}
      onRegenerate={regenerateResponse}
      // --- REMOVED isThinking and thinkingContent props ---
    />
  );
};

export default ChatPage;