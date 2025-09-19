// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './App.css';
import './css/SettingsModal.css';
import './css/Notification.css'; 
import './css/AuthPage.css';
import './css/Tooltip.css';
import './css/CodeAnalysisBlock.css';
import 'katex/dist/katex.min.css';
import './css/PricingPage.css'; // Import new CSS

import PrivateRoute from './routing/PrivateRoute';
import MainAppLayout from './pages/MainAppLayout';
import AuthPage from './pages/AuthPage';
import { useSettings } from './contexts/SettingsContext';

// --- Lazily load page components ---
const ChatPage = lazy(() => import('./pages/ChatPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PricingPage = lazy(() => import('./pages/PricingPage')); // <-- Add this

// --- Full screen loader for suspense fallback ---
const FullScreenLoader = () => (
  <div className="initial-loading-screen">
    <div className="bouncing-loader">
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>
);


function App() {
  const { isAuthenticated } = useSettings();

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* --- Public Routes --- */}
        <Route 
          path="/"
          element={isAuthenticated ? <Navigate to="/app" /> : <LandingPage />} 
        />
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/app" /> : <AuthPage />} 
        />
        <Route 
          path="/register" 
          element={isAuthenticated ? <Navigate to="/app" /> : <AuthPage />} 
        />
        
        {/* --- Private Application Routes --- */}
        <Route 
          path="/app"
          element={
            <PrivateRoute>
              <MainAppLayout />
            </PrivateRoute>
          }
        >
          {/* Child routes render inside MainAppLayout's <Outlet> */}
          <Route index element={<ChatPage />} />
          <Route path="c/:chatId" element={<ChatPage />} />
          <Route path="pricing" element={<PricingPage />} /> {/* <-- Add this route */}
        </Route>
        
        {/* --- Fallback Route --- */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/app" : "/"} />} />
      </Routes>
    </Suspense>
  );
}

export default App;