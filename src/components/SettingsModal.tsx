// src/components/SettingsModal.tsx
import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import '../css/SettingsModal.css';
import { FiRefreshCw, FiCpu, FiSliders, FiEye, FiEyeOff, FiMoreVertical, FiTerminal } from "react-icons/fi"; 
import api from '../utils/api';
import Tooltip from './Tooltip';

type Model = { id: string };
type Modality = 'text' | 'image' | 'code';
type ModelConfig = {
  id: string;
  modalities: Modality[];
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ActiveTab = 'GPT' | 'Appearance';

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, models, setModels, updateSettings, theme, setTheme } = useSettings();
  const { showNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('GPT');
  const [apiKey, setApiKey] = useState(user?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(user?.baseUrl || '');
  const [selectedModel, setSelectedModel] = useState(user?.selectedModel || '');
  const [quickAccessModels, setQuickAccessModels] = useState<string[]>(user?.quickAccessModels || []);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(user?.modelConfigs || []);
  
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  const [openConfigMenuId, setOpenConfigMenuId] = useState<string | null>(null);
  const configMenuRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (user) {
      setApiKey(user.apiKey);
      setBaseUrl(user.baseUrl);
      setSelectedModel(user.selectedModel);
      setQuickAccessModels(user.quickAccessModels || []);
      setModelConfigs(user.modelConfigs || []);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      setIsApiKeyVisible(false);
      setOpenConfigMenuId(null);
    }
  }, [isOpen]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configMenuRef.current && !configMenuRef.current.contains(event.target as Node)) {
        setOpenConfigMenuId(null);
      }
    };
    if (openConfigMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openConfigMenuId]);


  if (!isOpen) return null;
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
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
      await updateSettings({ apiKey, baseUrl });
      const response = await api('/models', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch models.');
      
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
      const configsToSave = modelConfigs.filter(config => quickAccessModels.includes(config.id));
      await updateSettings({ apiKey, baseUrl, selectedModel, quickAccessModels, modelConfigs: configsToSave });
      showNotification('Settings Saved!');
      handleClose();
    } catch (err) {
      showNotification('Failed to save settings.', 'error');
    }
  };
  
  const handleQuickAccessChange = (modelId: string) => {
    setQuickAccessModels(prev => 
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };
  
  const handleModalityChange = (modelId: string, modalityToToggle: Modality, isEnabled: boolean) => {
    setModelConfigs(prevConfigs => {
      const newConfigs = [...prevConfigs];
      const configIndex = newConfigs.findIndex(c => c.id === modelId);

      if (configIndex > -1) {
        // Config exists, so we update it.
        const configToUpdate = { ...newConfigs[configIndex] };
        const modalitiesSet = new Set(configToUpdate.modalities);

        if (isEnabled) {
          modalitiesSet.add(modalityToToggle);
        } else {
          modalitiesSet.delete(modalityToToggle);
        }
        
        configToUpdate.modalities = Array.from(modalitiesSet);
        newConfigs[configIndex] = configToUpdate;
      } else {
        // No config, create a new one. 'text' is always default.
        const newModalities: Modality[] = ['text'];
        if (isEnabled) {
          newModalities.push(modalityToToggle);
        }
        newConfigs.push({ id: modelId, modalities: newModalities });
      }

      return newConfigs;
    });
  };

  const renderGptTab = () => (
    <>
      <h3>GPT Settings</h3>
      <p>Configure your connection to a compatible LLM provider.</p>
      <div className="form-group">
        <label htmlFor="apiKey">API Key</label>
        <div className="input-wrapper">
          <input 
            id="apiKey" 
            type={isApiKeyVisible ? 'text' : 'password'}
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)} 
            placeholder="Required: sk-..." 
          />
          <Tooltip text={isApiKeyVisible ? "Hide API Key" : "Show API Key"}>
            <button 
              type="button"
              className="visibility-toggle-btn"
              onClick={() => setIsApiKeyVisible(prev => !prev)}
            >
              {isApiKeyVisible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="baseUrl">Base URL (optional)</label>
        <input id="baseUrl" type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="e.g., https://api.groq.com/openai/v1" />
      </div>
      <div className="form-group">
        <label htmlFor="model">Default Model</label>
        <div className="model-select-wrapper">
          <select id="model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} disabled={models.length === 0}>
            {models.length > 0 ? (
              models.map(model => <option key={model.id} value={model.id}>{model.id}</option>)
            ) : (
              <option>Click Refresh to load models</option>
            )}
          </select>
          <Tooltip text={!apiKey ? "API Key is required" : "Save credentials & Refresh models"}>
            <button className="refresh-button" onClick={handleFetchModels} disabled={isFetching || !apiKey}>
              {isFetching ? '...' : <FiRefreshCw size={16} />}
            </button>
          </Tooltip>
        </div>
        {fetchError && <p className="error-text">{fetchError}</p>}
      </div>
      {models.length > 0 && (
        <div className="form-group">
          <label>Quick Access Models</label>
          <p className="description">Select which models appear in the top-of-screen selector. You can configure modalities for selected models.</p>
          <div className="quick-access-list">
            {models.map(model => {
              const config = modelConfigs.find(c => c.id === model.id) || { modalities: ['text'] };
              const hasImageModality = config.modalities.some(modality => modality === 'image');
              const hasCodeModality = config.modalities.some(modality => modality === 'code');


              return (
              <div key={model.id} className="quick-access-row">
                <label className="quick-access-item">
                  <input 
                    type="checkbox"
                    checked={quickAccessModels.includes(model.id)}
                    onChange={() => handleQuickAccessChange(model.id)}
                  />
                  <span className="checkbox-visual"></span>
                  <span className="model-name-text">{model.id}</span>
                </label>
                
                <div className="model-config-wrapper">
                  <button
                    className="model-config-button"
                    onClick={() => setOpenConfigMenuId(openConfigMenuId === model.id ? null : model.id)}
                    disabled={!quickAccessModels.includes(model.id)}
                  >
                    <FiMoreVertical size={16}/>
                  </button>
                  {openConfigMenuId === model.id && (
                    <div className="model-config-menu" ref={configMenuRef}>
                       <label className="config-menu-item">
                          <input type="checkbox" checked disabled />
                          <span className="checkbox-visual"></span>
                          <span>Text</span>
                       </label>
                       <label className="config-menu-item">
                          <input 
                            type="checkbox" 
                            checked={hasImageModality}
                            onChange={(e) => handleModalityChange(model.id, 'image', e.target.checked)}
                          />
                          <span className="checkbox-visual"></span>
                          <span>Image</span>
                       </label>
                       <label className="config-menu-item">
                          <input 
                            type="checkbox" 
                            checked={hasCodeModality}
                            onChange={(e) => handleModalityChange(model.id, 'code', e.target.checked)}
                          />
                          <span className="checkbox-visual"></span>
                          <FiTerminal size={14} style={{ marginRight: '6px' }}/>
                          <span>Code</span>
                       </label>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="modal-actions">
        <button className="modal-button modal-button-cancel" onClick={handleClose}>Cancel</button>
        <button className="modal-button modal-button-save" onClick={handleSave}>Save & Close</button>
      </div>
    </>
  );

  const renderAppearanceTab = () => (
    <>
      <h3>Appearance</h3>
      <p>Customize the look and feel of the application.</p>
      <div className="form-group">
        <label>Theme</label>
        <div className="theme-options">
          <div 
            className={`theme-card ${theme === 'light' ? 'selected' : ''}`}
            onClick={() => setTheme('light')}
            data-theme-name="light"
          >
            <div className="theme-preview">Aa</div>
            <span>Light</span>
          </div>
          <div 
            className={`theme-card ${theme === 'dark' ? 'selected' : ''}`}
            onClick={() => setTheme('dark')}
            data-theme-name="dark"
          >
            <div className="theme-preview">Aa</div>
            <span>Dark</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className={`modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`modal-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <aside className="settings-sidebar">
          <h2>Settings</h2>
          <button className={`settings-tab-button ${activeTab === 'GPT' ? 'active' : ''}`} onClick={() => setActiveTab('GPT')}>
            <FiCpu size={18} />
            <span>GPT</span>
          </button>
          <button className={`settings-tab-button ${activeTab === 'Appearance' ? 'active' : ''}`} onClick={() => setActiveTab('Appearance')}>
            <FiSliders size={18} />
            <span>Appearance</span>
          </button>
        </aside>
        <main className="settings-content">
          {activeTab === 'GPT' && renderGptTab()}
          {activeTab === 'Appearance' && renderAppearanceTab()}
        </main>
      </div>
    </div>
  );
};

export default SettingsModal;