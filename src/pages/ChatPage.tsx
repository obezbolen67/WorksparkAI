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
    isSending, // <-- Get the new sending state
    sendMessage, // <-- This function now handles attachments
    isStreaming, 
    editingIndex, 
    startEditing, 
    cancelEditing, 
    saveAndSubmitEdit, 
    regenerateResponse 
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
      activeChatId={activeChatId} // <-- Pass down ID for attachment URLs
      isStreaming={isStreaming}
      isLoading={isLoadingChat}
      isSending={isSending} // <-- Pass down sending status
      onSendMessage={sendMessage} // <-- Pass down the updated function
      editingIndex={editingIndex}
      onStartEdit={startEditing}
      onCancelEdit={cancelEditing}
      onSaveEdit={saveAndSubmitEdit}
      onRegenerate={regenerateResponse}
    />
  );
};

export default ChatPage;