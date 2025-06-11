// src/contexts/SettingsContext.tsx
import { createContext, useState, useEffect, useContext, type ReactNode, useCallback } from 'react';
import api, { API_BASE_URL } from '../utils/api'; 

type Model = {
  id: string;
};

// --- UPDATED: Add 'code' modality ---
type Modality = 'text' | 'image' | 'code';

type ModelConfig = {
  id: string;
  modalities: Modality[];
};


type User = {
  _id: string;
  email: string;
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  quickAccessModels?: string[];
  modelConfigs?: ModelConfig[]; // --- Add new field to User type ---
};

type Theme = 'dark' | 'light';

interface SettingsContextType {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  models: Model[];
  selectedModel: string;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setModels: (models: Model[]) => void;
  loadUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateSettings: (settings: Partial<User>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('fexo-token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('fexo-theme') as Theme) || 'dark');

  useEffect(() => {
    const body = document.body;
    body.setAttribute('data-theme', theme);
    localStorage.setItem('fexo-theme', theme);
  }, [theme]);
  
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const loadUser = useCallback(async () => {
    const currentToken = localStorage.getItem('fexo-token');
    if (currentToken) {
      try {
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

  useEffect(() => {
    const fetchModelsOnLoad = async () => {
      if (user && user.apiKey) {
        try {
          const res = await api('/models', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            setModels(data);
          } else {
            console.error('Failed to auto-load models on startup.');
            setModels([]);
          }
        } catch (err) {
          console.error('Error auto-loading models:', err);
          setModels([]);
        }
      }
    };
    fetchModelsOnLoad();
  }, [user]);

  const apiAuthRequest = async (endpoint: 'login' | 'register', body: object) => {
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
    setModels([]);
    setLoading(false);
  };

  const updateSettings = async (settings: Partial<User>) => {
    if (!token) return;
    try {
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
        models, setModels, theme, setTheme,
        selectedModel: user?.selectedModel || '',
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