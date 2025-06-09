// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './css/SettingsModal.css';
import './css/Notification.css'; 
import './css/AuthPage.css';

import PrivateRoute from './routing/PrivateRoute';
import MainAppLayout from './pages/MainAppLayout';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage'; // Import ChatPage
import { useSettings } from './contexts/SettingsContext';

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
      
      {/* --- UPDATED: Nested Routing --- */}
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