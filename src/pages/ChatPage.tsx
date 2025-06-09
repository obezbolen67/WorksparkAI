// src/pages/ChatPage.tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import ChatView from '../components/ChatView';
import '../css/ChatView.css';

const ChatPage = () => {
  const { 
    messages, activeChatId, loadChat, clearChat, isLoadingChat, 
    isCreatingChat, sendMessage, isStreaming, editingIndex, 
    startEditing, cancelEditing, saveAndSubmitEdit, regenerateResponse 
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
      isStreaming={isStreaming}
      // --- THIS IS THE FIX ---
      // Only show the full-screen loader when fetching an existing chat's history.
      // `isCreatingChat` no longer triggers the overlay, allowing the user to see
      // the initial messages and streaming response in a new chat.
      isLoading={isLoadingChat}
      onSendMessage={(text) => sendMessage(text)}
      editingIndex={editingIndex}
      onStartEdit={startEditing}
      onCancelEdit={cancelEditing}
      onSaveEdit={saveAndSubmitEdit}
      onRegenerate={regenerateResponse}
    />
  );
};

export default ChatPage;