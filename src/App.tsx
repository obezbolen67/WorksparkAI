// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './css/SettingsModal.css';
import './css/Notification.css'; 
import './css/AuthPage.css'; // Import new CSS

import PrivateRoute from './routing/PrivateRoute';
import MainAppLayout from './pages/MainAppLayout';
import AuthPage from './pages/AuthPage';
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
      <Route 
        path="/"
        element={
          <PrivateRoute>
            <MainAppLayout />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;