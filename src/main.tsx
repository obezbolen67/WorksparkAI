import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { NotificationProvider } from './contexts/NotificationContext.tsx'
import { NavigationProvider } from './contexts/NavigationContext.tsx'

// --- PRODUCTION LOGGING SUPPRESSION ---
if (import.meta.env.PROD) {
  // Save the original error logger just in case you need it for a monitoring service (like Sentry)
  // const originalError = console.error;

  // Override console methods to do nothing in production
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
  
  // Optionally suppress errors too, though usually not recommended:
  // console.error = () => {};
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        // This log will now automatically be suppressed in PROD
        console.log('SW registered with scope: ', registration.scope);
      })
      .catch(registrationError => {
        // Errors are usually preserved
        console.error('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <SettingsProvider>
          <NavigationProvider>
            <App />
          </NavigationProvider>
        </SettingsProvider>
      </NotificationProvider>
    </BrowserRouter>
  </StrictMode>,
)