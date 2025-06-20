// src/pages/MainAppLayout.tsx
import { useState, Suspense, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import Notification from '../components/Notification';
import { ChatProvider } from '../contexts/ChatContext';
import MobileHeader from '../components/MobileHeader';
import SuspensionBanner from '../components/SuspensionBanner';
import SuspensionInfoModal from '../components/SuspensionInfoModal';
import { useSettings } from '../contexts/SettingsContext'; // Import useSettings
import '../css/MobileHeader.css';
import '../css/SuspensionBanner.css';
import '../css/SuspensionInfoModal.css';


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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false);
  const navigate = useNavigate();

  // --- START OF LOGIC TO SHOW BANNER ---
  const { user } = useSettings();
  const suspendedUserIds = ["684ab97ebfb3f163a6f41b45", "68472ce3cc93764b63447857"];
  const showSuspensionBanner = user ? suspendedUserIds.includes(user._id) : false;

  useEffect(() => {
    const bodyClass = 'with-suspension-banner';
    if (showSuspensionBanner) {
      document.body.classList.add(bodyClass);
    } else {
      document.body.classList.remove(bodyClass);
    }
    // Cleanup function to remove the class when the component unmounts
    return () => {
      document.body.classList.remove(bodyClass);
    };
  }, [showSuspensionBanner]);
  // --- END OF LOGIC TO SHOW BANNER ---

  return (
    <ChatProvider>
      <Notification />
      
      {/* Conditionally render the banner itself */}
      {showSuspensionBanner && <SuspensionBanner onSeeMoreClick={() => setIsSuspensionModalOpen(true)} />}

      <MobileHeader 
        onToggleSidebar={() => setMobileSidebarOpen(true)}
        onNewChat={() => {
          navigate('/');
          setMobileSidebarOpen(false);
        }}
      />
      <div className="app-container">
        <Sidebar 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      
      {/* Conditionally render the modal */}
      {showSuspensionBanner && (
        <SuspensionInfoModal
          isOpen={isSuspensionModalOpen}
          onClose={() => setIsSuspensionModalOpen(false)}
        />
      )}
    </ChatProvider>
  );
};

export default MainAppLayout;