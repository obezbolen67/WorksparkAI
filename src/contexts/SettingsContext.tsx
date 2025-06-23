import { createContext, useState, useEffect, useContext, type ReactNode, useCallback } from 'react';
import api, { API_BASE_URL } from '../utils/api'; 

type Model = {
  id: string;
};

type Modality = 'text' | 'image' | 'code' | 'reasoning';

type ModelConfig = {
  id: string;
  modalities: Modality[];
};

type Theme = 'dark' | 'light';

type ApiKeyEntry = {
  provider: string;
  key: string;
};

type User = {
  _id: string;
  email: string;
  apiKeys: ApiKeyEntry[];
  baseUrl: string;
  selectedModel: string;
  theme: Theme;
  quickAccessModels?: string[];
  modelConfigs?: ModelConfig[];
};

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
  
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('fexo-theme') as Theme) || 'light');

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

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    if (isAuthenticated) {
      updateSettings({ theme: newTheme }).catch(err => {
        console.error("Could not save theme preference to the database.", err);
      });
    }
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('fexo-theme', theme);
  }, [theme]);
  
  const loadUser = useCallback(async () => {
    const currentToken = localStorage.getItem('fexo-token');
    if (currentToken) {
      try {
        const res = await api('/settings');
        if (!res.ok) throw new Error('Failed to load user');
        const userData: User = await res.json();
        setUser(userData);
        setIsAuthenticated(true);
        if (userData.theme) {
          setThemeState(userData.theme);
        }
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
      if (user && user.apiKeys && user.apiKeys.length > 0) {
        const provider = user.selectedModel?.includes('claude') ? 'anthropic' : (user.selectedModel?.includes('gemini') ? 'gemini' : 'openai');
        
        if (user.apiKeys.some(k => k.provider === provider && k.key)) {
            try {
                const res = await api('/models', { method: 'POST', body: JSON.stringify({ provider }) });
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
    setThemeState('light'); 
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setModels([]);
    setLoading(false);
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