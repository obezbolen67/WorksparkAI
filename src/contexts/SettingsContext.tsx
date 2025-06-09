// src/contexts/SettingsContext.tsx
import { createContext, useState, useEffect, useContext, type ReactNode, useCallback } from 'react';
// --- UPDATED: Import the base URL as well ---
import api, { API_BASE_URL } from '../utils/api'; 

// Define a simple model type
type Model = {
  id: string;
};

// Define the User type matching our backend model
type User = {
  _id: string;
  email: string;
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
};

// --- NEW: Define Theme type ---
type Theme = 'dark' | 'light';

interface SettingsContextType {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  models: Model[];
  theme: Theme; // <-- ADDED
  setTheme: (theme: Theme) => void; // <-- ADDED
  setModels: (models: Model[]) => void;
  loadUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateSettings: (settings: Partial<User>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// --- DELETED: This is no longer the source of truth ---
// const API_URL = 'http://localhost:3001/api';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('fexo-token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  // --- NEW: Theme state initialized from localStorage or default to 'dark' ---
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('fexo-theme') as Theme) || 'dark');

  // --- NEW: Effect to apply theme to the body ---
  useEffect(() => {
    const body = document.body;
    body.setAttribute('data-theme', theme);
    localStorage.setItem('fexo-theme', theme);
  }, [theme]);
  
  // --- NEW: Wrapper function for setting theme ---
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const loadUser = useCallback(async () => {
    const currentToken = localStorage.getItem('fexo-token');
    if (currentToken) {
      try {
        // Use the new api wrapper. Token is added automatically.
        const res = await api('/settings');

        if (!res.ok) throw new Error('Failed to load user');
        
        const userData = await res.json();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (err) {
        console.error(err);
        localStorage.removeItem('fexo-token');
        setToken(null);
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const apiAuthRequest = async (endpoint: 'login' | 'register', body: object) => {
    // Auth requests don't use the token, so we use fetch directly here.
    // --- UPDATED: Use the imported API_BASE_URL ---
    const res = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.errors?.[0]?.msg || 'Authentication failed');
    }
    localStorage.setItem('fexo-token', data.token);
    setToken(data.token);
    await loadUser();
  };

  const login = (email: string, password: string) => apiAuthRequest('login', { email, password });
  const register = (email: string, password: string) => apiAuthRequest('register', { email, password });

  const logout = () => {
    localStorage.removeItem('fexo-token');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setLoading(false);
  };

  const updateSettings = async (settings: Partial<User>) => {
    if (!token) return;
    try {
      // Use the new api wrapper.
      const res = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to update settings');
      const updatedUser = await res.json();
      setUser(updatedUser);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return (
    <SettingsContext.Provider 
      value={{ 
        token, isAuthenticated, loading, user,
        models, setModels, theme, setTheme, // <-- ADDED theme and setTheme
        loadUser, login, register, logout, updateSettings
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};