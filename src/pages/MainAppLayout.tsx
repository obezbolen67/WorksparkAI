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
import { useSettings } from '../contexts/SettingsContext';
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
  const { user } = useSettings();

  // --- START OF BANNER DISMISSAL LOGIC ---

  // 1. Initialize state by reading from localStorage on first render.
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    return localStorage.getItem('fexo-suspension-banner-dismissed') === 'true';
  });

  const suspendedUserIds = ["684ab97ebfb3f163a6f41b45", "68472ce3cc93764b63447857"];
  
  // 2. Determine if the banner should be shown.
  const showSuspensionBanner = user 
    ? suspendedUserIds.includes(user._id) && !isBannerDismissed 
    : false;

  // 3. Create a handler to dismiss the banner permanently.
  const handleDismissBanner = () => {
    localStorage.setItem('fexo-suspension-banner-dismissed', 'true');
    setIsBannerDismissed(true); // Update state to hide it immediately
    setIsSuspensionModalOpen(false); // Also close the modal
  };

  useEffect(() => {
    const bodyClass = 'with-suspension-banner';
    if (showSuspensionBanner) {
      document.body.classList.add(bodyClass);
    } else {
      document.body.classList.remove(bodyClass);
    }
    return () => {
      document.body.classList.remove(bodyClass);
    };
  }, [showSuspensionBanner]);
  // --- END OF BANNER DISMISSAL LOGIC ---

  return (
    <ChatProvider>
      <Notification />
      
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
      
      {showSuspensionBanner && (
        <SuspensionInfoModal
          isOpen={isSuspensionModalOpen}
          onClose={() => setIsSuspensionModalOpen(false)} // This just closes the modal
          onDismissAndClose={handleDismissBanner} // This dismisses the banner
        />
      )}
    </ChatProvider>
  );
};

export default MainAppLayout;