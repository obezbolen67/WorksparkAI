// src/pages/MainAppLayout.tsx
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import Notification from '../components/Notification';
import { ChatProvider } from '../contexts/ChatContext';
// --- NEW IMPORTS ---
import MobileHeader from '../components/MobileHeader';
import '../css/MobileHeader.css';

const MainAppLayout = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // --- NEW STATE FOR MOBILE SIDEBAR ---
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    // This provider makes all chat functionality available to its children
    <ChatProvider>
      <Notification />
      {/* --- NEW: Add Mobile Header --- */}
      <MobileHeader 
        onToggleSidebar={() => setMobileSidebarOpen(true)}
        onNewChat={() => {
          navigate('/');
          setMobileSidebarOpen(false); // Close sidebar if open
        }}
      />
      <div className="app-container">
        <Sidebar 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          // --- NEW PROPS ---
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
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