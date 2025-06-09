// src/pages/ChatPage.tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import ChatView from '../components/ChatView';
import '../css/ChatView.css';

const ChatPage = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { 
    messages, activeChatId, loadChat, clearChat, isLoadingChat, 
    isCreatingChat, // Destructure the new state
    sendMessage, isStreaming, editingIndex, startEditing, 
    cancelEditing, saveAndSubmitEdit, regenerateResponse 
  } = useChat();

  useEffect(() => {
    if (chatId && chatId !== activeChatId) {
      loadChat(chatId);
    } else if (!chatId) {
      clearChat();
    }
  }, [chatId, activeChatId, loadChat, clearChat]);

  return (
    <ChatView 
      messages={messages} 
      isStreaming={isStreaming}
      // Combine both loading states for the UI
      isLoading={isLoadingChat || isCreatingChat}
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