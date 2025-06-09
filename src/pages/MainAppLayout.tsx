// src/pages/MainAppLayout.tsx
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatView from '../components/ChatView';
import SettingsModal from '../components/SettingsModal';
import Notification from '../components/Notification';

const MainAppLayout = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Notification />
      <div className="app-container">
        <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
        <ChatView />
      </div>
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
};

export default MainAppLayout;