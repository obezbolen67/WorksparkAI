// src/contexts/NotificationContext.tsx
import { createContext, useState, useRef, useContext, type ReactNode } from 'react';

interface NotificationContextType {
  showNotification: (message: string, type?: 'success' | 'error') => void;
  notificationMessage: string;
  isNotificationVisible: boolean;
  notificationType: 'success' | 'error';
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const timeoutRef = useRef<number | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setNotificationMessage(message);
    setNotificationType(type);
    setIsNotificationVisible(true);
    
    timeoutRef.current = window.setTimeout(() => {
      setIsNotificationVisible(false);
    }, 2500);
  };

  const value = { showNotification, notificationMessage, isNotificationVisible, notificationType };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};