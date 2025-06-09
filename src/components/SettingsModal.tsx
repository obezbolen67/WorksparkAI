// src/components/SettingsModal.tsx
import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import '../css/SettingsModal.css';
import { FiRefreshCw } from "react-icons/fi";

type Model = { id: string };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, models, setModels, updateSettings, token } = useSettings();
  const { showNotification } = useNotification();
  
  const [apiKey, setApiKey] = useState(user?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(user?.baseUrl || '');
  const [selectedModel, setSelectedModel] = useState(user?.selectedModel || '');
  
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (user) {
      setApiKey(user.apiKey);
      setBaseUrl(user.baseUrl);
      setSelectedModel(user.selectedModel);
    }
  }, [user]);

  if (!isOpen) return null;
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false); // Reset for next time
    }, 300); // Match animation duration
  };

  const handleFetchModels = async () => {
    if (!apiKey) {
      setFetchError('API Key is required to fetch models.');
      return;
    }
    
    setIsFetching(true);
    setFetchError('');
    setModels([]);

    try {
      // First, save the current credentials before fetching
      await updateSettings({ apiKey, baseUrl });
      
      const response = await fetch('http://localhost:3001/api/models', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token || '' 
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch models.');
      }
      
      setModels(data);
      showNotification('Models refreshed successfully!', 'success');
      
      if (!selectedModel || !data.some((m: Model) => m.id === selectedModel)) {
        setSelectedModel(data[0]?.id || '');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setFetchError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings({ apiKey, baseUrl, selectedModel });
      showNotification('Settings Saved!');
      handleClose();
    } catch (err) {
      showNotification('Failed to save settings.', 'error');
    }
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2>API Settings</h2>
        <p>Your settings are stored securely with your account.</p>
        
        <div className="form-group">
          <label htmlFor="apiKey">API Key</label>
          <input
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Required: sk-..."
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="baseUrl">Base URL (optional)</label>
          <input
            id="baseUrl"
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="e.g., https://api.groq.com/openai/v1"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="model">Model</label>
          <div className="model-select-wrapper">
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={models.length === 0}
            >
              {models.length > 0 ? (
                models.map(model => <option key={model.id} value={model.id}>{model.id}</option>)
              ) : (
                <option>Click Refresh to load models</option>
              )}
            </select>
            <button 
              className="refresh-button" 
              onClick={handleFetchModels} 
              disabled={isFetching || !apiKey}
              title={!apiKey ? "API Key is required" : "Save credentials & Refresh models"}
            >
              {isFetching ? '...' : <FiRefreshCw size={16} />}
            </button>
          </div>
          {fetchError && <p className="error-text">{fetchError}</p>}
        </div>
        
        <div className="modal-actions">
          <button className="modal-button modal-button-cancel" onClick={handleClose}>Cancel</button>
          <button className="modal-button modal-button-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;