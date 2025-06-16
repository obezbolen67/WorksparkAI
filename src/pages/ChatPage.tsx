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
    isThinkingEnabled,
    toggleThinking,
    isSending,
    isThinking,
    sendMessage,
    stopGeneration, // <-- NEW

    isStreaming, 
    editingIndex, 
    startEditing, 
    cancelEditing, 
    saveAndSubmitEdit, 
    regenerateResponse,
  } = useChat();
  
  const { chatId } = useParams<{ chatId: string }>();

  useEffect(() => {
    if (isCreatingChat) return;
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
      isThinkingEnabled={isThinkingEnabled}
      toggleThinkingEnabled={toggleThinking}
      activeChatId={activeChatId}
      isStreaming={isStreaming}
      isLoading={isLoadingChat}
      isSending={isSending}
      isThinking={isThinking}
      onSendMessage={sendMessage}
      onStopGeneration={stopGeneration} // <-- NEW
      onRegenerate={regenerateResponse}
      editingIndex={editingIndex}
      onStartEdit={startEditing}
      onCancelEdit={cancelEditing}
      onSaveEdit={saveAndSubmitEdit}
    />
  );
};

export default ChatPage;