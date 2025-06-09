// src/components/Notification.tsx
import { useNotification } from '../contexts/NotificationContext';
import '../css/Notification.css';

const Notification = () => {
  const { notificationMessage, isNotificationVisible, notificationType } = useNotification();

  return (
    <div className={`notification-popup ${isNotificationVisible ? 'visible' : ''} ${notificationType}`}>
      {notificationMessage}
    </div>
  );
};

export default Notification;