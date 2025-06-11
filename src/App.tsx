// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import './App.css';
import './css/SettingsModal.css';
import './css/Notification.css'; 
import './css/AuthPage.css';
import './css/Tooltip.css';
import './css/CodeAnalysisBlock.css';

import PrivateRoute from './routing/PrivateRoute';
import MainAppLayout from './pages/MainAppLayout';
import AuthPage from './pages/AuthPage';
import { useSettings } from './contexts/SettingsContext';

// --- Lazily load the ChatPage component ---
const ChatPage = lazy(() => import('./pages/ChatPage'));

function App() {
  const { isAuthenticated } = useSettings();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" /> : <AuthPage />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/" /> : <AuthPage />} 
      />
      
      {/* --- Nested Routing --- */}
      <Route 
        path="/"
        element={
          <PrivateRoute>
            <MainAppLayout />
          </PrivateRoute>
        }
      >
        {/* Child routes that will render inside MainAppLayout's <Outlet> */}
        <Route index element={<ChatPage />} />
        <Route path="c/:chatId" element={<ChatPage />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;