// src/routing/PrivateRoute.tsx
import { type ReactNode } from 'react'; // <-- ADD THIS IMPORT
import { Navigate } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

const PrivateRoute = ({ children }: { children: ReactNode }) => { // <-- CHANGE JSX.Element to ReactNode
  const { isAuthenticated, loading } = useSettings();

  if (loading) {
    // You can return a loading spinner here
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute;