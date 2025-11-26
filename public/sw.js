// FexoApp/public/sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle server-sent Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'Workspark AI Notification';
  const options = {
    body: data.body || 'You have a new task.',
    icon: '/worksparkai.svg', // Ensure this file exists in public/
    badge: '/worksparkai.svg',
    data: {
      url: '/', // Open the app root
      taskId: data.taskId
    },
    // 'requireInteraction' keeps it visible until user clicks on Desktop
    requireInteraction: true 
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});