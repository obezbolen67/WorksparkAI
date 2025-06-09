// 📁 src/routing/PrivateRoute.tsx
import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useSettings();

  if (loading) {
    // Return a simple div that will be styled by App.css to be a full-screen background.
    // This respects the user's theme (dark/light) from the start.
    return <div className="initial-loading-screen"></div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute;