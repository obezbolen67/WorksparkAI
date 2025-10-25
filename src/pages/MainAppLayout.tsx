// src/pages/MainAppLayout.tsx
import { useEffect, useState, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import SettingsModal from '../components/SettingsModal';
import Notification from '../components/Notification';
import { ChatProvider } from '../contexts/ChatContext';
import MobileHeader from '../components/MobileHeader';
import '../css/MobileHeader.css';
import SubscriptionSuccessOverlay from '../components/SubscriptionSuccessOverlay';
import '../css/SubscriptionSuccessOverlay.css';


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
  const [showSubOverlay, setShowSubOverlay] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Detect subscription success flag in URL and show overlay
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('sub_success')) {
      setShowSubOverlay(true);
      // Clean URL
      const cleanPath = location.pathname;
      navigate(cleanPath, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);
  return (
    <>
      {/* Render overlay at root level, outside ChatProvider and app-container */}
      {showSubOverlay && (
        <SubscriptionSuccessOverlay onClose={() => setShowSubOverlay(false)} />
      )}
      
      <ChatProvider>
        <Notification />

        <MobileHeader 
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          onNewChat={() => {
            navigate('/app'); // <-- UPDATED: Navigate to the new app root
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
      </ChatProvider>
    </>
  );
};

export default MainAppLayout;