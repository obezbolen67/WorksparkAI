import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { NotificationProvider } from './contexts/NotificationContext.tsx'
import { NavigationProvider } from './contexts/NavigationContext.tsx'

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