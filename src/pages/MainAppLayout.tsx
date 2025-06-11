// src/pages/MainAppLayout.tsx
import { useState, Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import Notification from '../components/Notification';
import { ChatProvider } from '../contexts/ChatContext';
// --- NEW IMPORTS ---
import MobileHeader from '../components/MobileHeader';
import '../css/MobileHeader.css';

// --- UPDATED: Fallback now uses the bouncing loader structure ---
const RouteFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%'
  }}>
    <div className="bouncing-loader">
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
);

const MainAppLayout = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // --- NEW: State for sidebar collapse ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          // --- NEW PROPS for collapse functionality ---
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />
        {/* --- Wrap Outlet in Suspense to handle lazy-loaded routes --- */}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ChatProvider>
  );
};

export default MainAppLayout;