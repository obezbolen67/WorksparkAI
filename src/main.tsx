import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { NotificationProvider } from './contexts/NotificationContext.tsx'
import { NavigationProvider } from './contexts/NavigationContext.tsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
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