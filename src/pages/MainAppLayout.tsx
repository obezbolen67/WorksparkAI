// src/pages/MainAppLayout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import Notification from '../components/Notification';
import { ChatProvider } from '../contexts/ChatContext'; // Correct import

const MainAppLayout = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    // This provider makes all chat functionality available to its children
    <ChatProvider>
      <Notification />
      <div className="app-container">
        <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
        {/* Outlet renders either the empty ChatPage or ChatPage with a chatId */}
        <Outlet />
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ChatProvider>
  );
};

export default MainAppLayout;