import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useNotification } from '../contexts/NotificationContext';
import '../css/SettingsModal.css';
import { FiRefreshCw, FiCpu, FiSliders, FiEye, FiEyeOff, FiMoreVertical } from "react-icons/fi";
import OpenAIIcon from '../icons/openai.svg?react';
import AnthropicIcon from '../icons/anthropic.svg?react';
import GeminiIcon from '../icons/gemini.svg?react';
import api from '../utils/api';
import Tooltip from './Tooltip';
import Portal from './Portal';
import ProviderSelector, { type Provider } from './ProviderSelector';
import CustomModelSelector from './CustomModelSelector';
import '../css/ProviderSelector.css';
import '../css/CustomModelSelector.css';

type Model = { id: string };
type Modality = 'text' | 'image' | 'code' | 'reasoning';
type ModelConfig = { id: string; modalities: Modality[]; };
type ApiKeyEntry = { provider: string; key: string; };

interface SettingsModalProps { isOpen: boolean; onClose: () => void; }
type ActiveTab = 'GPT' | 'Appearance';
type ProviderId = 'openai' | 'anthropic' | 'gemini';

const providers: Provider[] = [
  { id: 'openai', name: 'OpenAI', Icon: OpenAIIcon },
  { id: 'anthropic', name: 'Anthropic', Icon: AnthropicIcon },
  { id: 'gemini', name: 'Gemini', Icon: GeminiIcon },
];

const MIN_CONTEXT = 4096;
const MAX_CONTEXT = 1000000;
// --- START OF CHANGE ---
const MIN_OUTPUT_TOKENS = 256;
const MAX_OUTPUT_TOKENS = 64000;
// --- END OF CHANGE ---

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, models, setModels, updateSettings, theme, setTheme } = useSettings();
  const { showNotification } = useNotification();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>('GPT');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(() => 
    user?.selectedModel?.includes('claude') ? 'anthropic' : (user?.selectedModel?.includes('gemini') ? 'gemini' : 'openai')
  );
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(user?.apiKeys || []);
  const [baseUrl, setBaseUrl] = useState(user?.baseUrl || '');
  const [selectedModel, setSelectedModel] = useState(user?.selectedModel || '');
  const [quickAccessModels, setQuickAccessModels] = useState<string[]>(user?.quickAccessModels || []);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(user?.modelConfigs || []);
  const [contextLength, setContextLength] = useState(user?.contextLength || MIN_CONTEXT);
  // --- START OF CHANGE ---
  const [maxOutputTokens, setMaxOutputTokens] = useState(user?.maxOutputTokens || 4096);
  // --- END OF CHANGE ---
  
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [openConfigMenuId, setOpenConfigMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const configMenuRef = useRef<HTMLDivElement>(null);

  const [isEditingContext, setIsEditingContext] = useState(false);
  const [editableContextValue, setEditableContextValue] = useState(String(contextLength));
  // --- START OF CHANGE ---
  const [isEditingMaxOutput, setIsEditingMaxOutput] = useState(false);
  const [editableMaxOutputValue, setEditableMaxOutputValue] = useState(String(maxOutputTokens));
  // --- END OF CHANGE ---

  useEffect(() => {
    if (!isEditingContext) {
      setEditableContextValue(String(contextLength));
    }
  }, [contextLength, isEditingContext]);

  // --- START OF CHANGE ---
  useEffect(() => {
    if (!isEditingMaxOutput) {
      setEditableMaxOutputValue(String(maxOutputTokens));
    }
  }, [maxOutputTokens, isEditingMaxOutput]);
  // --- END OF CHANGE ---

  useEffect(() => {
    if (user) {
      setApiKeys(user.apiKeys || []);
      setBaseUrl(user.baseUrl || '');
      setSelectedModel(user.selectedModel || '');
      setQuickAccessModels(user.quickAccessModels || []);
      setModelConfigs(user.modelConfigs || []);
      setContextLength(user.contextLength || MIN_CONTEXT);
      // --- START OF CHANGE ---
      setMaxOutputTokens(user.maxOutputTokens || 4096);
      // --- END OF CHANGE ---
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      setIsApiKeyVisible(false);
      setOpenConfigMenuId(null);
      setIsEditingContext(false);
      // --- START OF CHANGE ---
      setIsEditingMaxOutput(false);
      // --- END OF CHANGE ---
    }
  }, [isOpen]);
  
  // ... (rest of useEffects for click handling remain the same) ...
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
  
  // ... (fetchProviderModels and related useEffects remain the same) ...
  const fetchProviderModels = useCallback(async (provider: ProviderId) => {
    const keyForProvider = apiKeys.find(k => k.provider === provider)?.key;
    if (!keyForProvider) {
        setModels([]);
        return;
    }

    setIsFetching(true);
    setFetchError('');
    try {
        const response = await api('/models', { method: 'POST', body: JSON.stringify({ provider }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch models.');
        
        setModels(data);
        
        if (selectedModel && !data.some((m: Model) => m.id === selectedModel)) {
            setSelectedModel('');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setFetchError(errorMessage);
        showNotification(errorMessage, 'error');
        setModels([]);
    } finally {
        setIsFetching(false);
    }
  }, [apiKeys, selectedModel, setModels, showNotification]);

  useEffect(() => {
    setFetchError('');
    setModels([]); 
    
    fetchProviderModels(selectedProvider);
  }, [selectedProvider, fetchProviderModels]);

  const handleApiKeyChange = (newKey: string) => {
    setApiKeys(prev => {
      const otherKeys = prev.filter(k => k.provider !== selectedProvider);
      if (newKey) {
        return [...otherKeys, { provider: selectedProvider, key: newKey }];
      }
      return otherKeys;
    });
  };
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleManualFetch = async () => {
    const currentApiKey = apiKeys.find(k => k.provider === selectedProvider)?.key;
    if (!currentApiKey) {
      const providerName = providers.find(p => p.id === selectedProvider)?.name || 'Current provider';
      setFetchError(`${providerName} API Key is required to fetch models.`);
      return;
    }
    await updateSettings({ apiKeys, baseUrl });
    await fetchProviderModels(selectedProvider);
  };

  const handleSave = async () => {
    const finalProvider = selectedModel.includes('claude') ? 'anthropic' : (selectedModel.includes('gemini') ? 'gemini' : 'openai');
    if (selectedModel && finalProvider !== selectedProvider) {
        showNotification('Provider and selected model do not match. Please re-select your default model.', 'error');
        return;
    }
    if (quickAccessModels.length > 0 && !selectedModel) {
        showNotification('Please select a default model from your Quick Access list.', 'error');
        return;
    }
    try {
      const configsToSave = modelConfigs.filter(config => quickAccessModels.includes(config.id));
      // --- START OF CHANGE ---
      await updateSettings({ 
        apiKeys, 
        baseUrl, 
        selectedModel, 
        quickAccessModels, 
        modelConfigs: configsToSave, 
        contextLength,
        maxOutputTokens // Save the new field
      });
      // --- END OF CHANGE ---
      showNotification('Settings Saved!');
      handleClose();
    } catch (err) {
      showNotification('Failed to save settings.', 'error');
    }
  };
  
  const handleQuickAccessChange = (modelId: string) => {
    if (quickAccessModels.includes(modelId)) {
        if (selectedModel === modelId) {
            setSelectedModel('');
        }
    }

    setQuickAccessModels(prev => 
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };
  
  // ... (handleModalityChange and handleMenuToggle remain the same) ...
  const handleModalityChange = (modelId: string, modalityToToggle: Modality, isEnabled: boolean) => {
    setModelConfigs(prevConfigs => {
      const newConfigs = [...prevConfigs];
      const configIndex = newConfigs.findIndex(c => c.id === modelId);

      if (configIndex > -1) {
        const configToUpdate = { ...newConfigs[configIndex] };
        const modalitiesSet = new Set(configToUpdate.modalities);
        if (isEnabled) modalitiesSet.add(modalityToToggle); else modalitiesSet.delete(modalityToToggle);
        configToUpdate.modalities = Array.from(modalitiesSet);
        newConfigs[configIndex] = configToUpdate;
      } else {
        const newModalities: Modality[] = ['text'];
        if (isEnabled) newModalities.push(modalityToToggle);
        newConfigs.push({ id: modelId, modalities: newModalities });
      }
      return newConfigs;
    });
  };

  const handleMenuToggle = (modelId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openConfigMenuId === modelId) {
      setOpenConfigMenuId(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + window.scrollY + 5, left: rect.left + window.scrollX });
      setOpenConfigMenuId(modelId);
    }
  };

  const handleProcessAndSetContextValue = () => {
    let numValue = parseInt(editableContextValue, 10);
    if (isNaN(numValue)) {
      numValue = contextLength;
    }
    const clampedValue = Math.max(MIN_CONTEXT, Math.min(numValue, MAX_CONTEXT));
    setContextLength(clampedValue);
    setIsEditingContext(false);
  };

  const handleContextInputBlur = () => {
    handleProcessAndSetContextValue();
  };

  const handleContextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleProcessAndSetContextValue();
    } else if (e.key === 'Escape') {
      setEditableContextValue(String(contextLength));
      setIsEditingContext(false);
    }
  };

  // --- START OF CHANGE ---
  // New handlers for the Max Output Tokens input
  const handleProcessAndSetMaxOutput = () => {
    let numValue = parseInt(editableMaxOutputValue, 10);
    if (isNaN(numValue)) {
      numValue = maxOutputTokens;
    }
    const clampedValue = Math.max(MIN_OUTPUT_TOKENS, Math.min(numValue, MAX_OUTPUT_TOKENS));
    setMaxOutputTokens(clampedValue);
    setIsEditingMaxOutput(false);
  };

  const handleMaxOutputInputBlur = () => {
    handleProcessAndSetMaxOutput();
  };

  const handleMaxOutputInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleProcessAndSetMaxOutput();
    } else if (e.key === 'Escape') {
      setEditableMaxOutputValue(String(maxOutputTokens));
      setIsEditingMaxOutput(false);
    }
  };
  // --- END OF CHANGE ---

  if (!isOpen) return null;

  const renderGptTab = () => {
    const currentApiKey = apiKeys.find(k => k.provider === selectedProvider)?.key || '';
    
    const defaultModelOptions = models.filter(model => quickAccessModels.includes(model.id));

    const getApiKeyPlaceholder = () => {
        switch (selectedProvider) {
            case 'openai': return 'Required: sk-...';
            case 'anthropic': return 'Required: sk-ant-...';
            case 'gemini': return 'Required: Your Gemini API Key';
            default: return 'API Key';
        }
    };

    return (
    <>
      <h3>GPT Settings</h3>
      <p>Configure your connection to a compatible LLM provider.</p>
      
      {/* ... Provider, API Key, Base URL form groups remain the same ... */}
       <div className="form-group">
        <label>Provider</label>
        <ProviderSelector 
            providers={providers}
            selectedProvider={selectedProvider}
            onSelect={(id) => setSelectedProvider(id as ProviderId)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="apiKey">API Key</label>
        <div className="input-wrapper">
          <input 
            id="apiKey" 
            type={isApiKeyVisible ? 'text' : 'password'}
            className={!isApiKeyVisible ? 'input-hidden' : ''}
            value={currentApiKey} 
            onChange={(e) => handleApiKeyChange(e.target.value)} 
            placeholder={ getApiKeyPlaceholder() }
          />
          <Tooltip text={isApiKeyVisible ? "Hide API Key" : "Show API Key"}>
            <button type="button" className="visibility-toggle-btn" onClick={() => setIsApiKeyVisible(prev => !prev)}>
              {isApiKeyVisible ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </Tooltip>
        </div>
      </div>

      {(selectedProvider === 'openai') && (
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
      )}

      {/* --- START OF CHANGE: Renamed first slider and added the new one --- */}
      <div className="form-group">
        <div className="label-with-value">
          <label htmlFor="contextLength">Total Context Length</label>
          {isEditingContext ? (
            <input
              type="number"
              value={editableContextValue}
              onChange={(e) => setEditableContextValue(e.target.value)}
              onBlur={handleContextInputBlur}
              onKeyDown={handleContextInputKeyDown}
              className="context-value-input"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          ) : (
            <span
              onClick={() => setIsEditingContext(true)}
              className="context-value-span"
            >
              {contextLength}
            </span>
          )}
        </div>
        <p className="description">
          The total token window for the model (input + output). Set this to your selected model's maximum context.
        </p>
        <div className="context-slider-group">
            <input 
                type="range" 
                id="contextLength"
                min={MIN_CONTEXT}
                max={MAX_CONTEXT}
                step="1024"
                value={contextLength}
                onChange={(e) => setContextLength(parseInt(e.target.value, 10))}
                className="context-slider"
            />
        </div>
      </div>

      <div className="form-group">
        <div className="label-with-value">
          <label htmlFor="maxOutputTokens">Max Output Tokens</label>
          {isEditingMaxOutput ? (
            <input
              type="number"
              value={editableMaxOutputValue}
              onChange={(e) => setEditableMaxOutputValue(e.target.value)}
              onBlur={handleMaxOutputInputBlur}
              onKeyDown={handleMaxOutputInputKeyDown}
              className="context-value-input"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
          ) : (
            <span
              onClick={() => setIsEditingMaxOutput(true)}
              className="context-value-span"
            >
              {maxOutputTokens}
            </span>
          )}
        </div>
        <p className="description">
          Controls the maximum tokens the model can generate in one response. This is reserved from the total context length.
        </p>
        <div className="context-slider-group">
            <input 
                type="range" 
                id="maxOutputTokens"
                min={MIN_OUTPUT_TOKENS}
                max={MAX_OUTPUT_TOKENS}
                step="256"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(parseInt(e.target.value, 10))}
                className="context-slider"
            />
        </div>
      </div>
      {/* --- END OF CHANGE --- */}

      {/* ... Quick Access and Default Model sections remain the same ... */}
      {models.length > 0 && (
        <>
        <div className="form-group">
          <label>Quick Access Models</label>
          <p className="description">Select which models appear in the top-of-screen selector. Only models selected here can be set as the default.</p>
          <div className="quick-access-list">
            {models.map(model => {
              const config = modelConfigs.find(c => c.id === model.id) || { modalities: ['text'] };
              const hasImageModality = config.modalities.some(modality => modality === 'image');

              return (
              <div key={model.id} className="quick-access-row">
                <label className="quick-access-item">
                  <input type="checkbox" checked={quickAccessModels.includes(model.id)} onChange={() => handleQuickAccessChange(model.id)} />
                  <span className="checkbox-visual"></span>
                  <span className="model-name-text">{model.id}</span>
                </label>
                <div className="model-config-wrapper">
                  <button className="model-config-button" onClick={(e) => handleMenuToggle(model.id, e)} disabled={!quickAccessModels.includes(model.id)}>
                    <FiMoreVertical size={16}/>
                  </button>
                  {openConfigMenuId === model.id && (
                    <Portal>
                      <div className="model-config-menu" ref={configMenuRef} style={{ position: 'absolute', top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}>
                         <label className="config-menu-item">
                            <input type="checkbox" checked disabled />
                            <span className="checkbox-visual"></span>
                            <span>Text</span>
                         </label>
                         <label className="config-menu-item">
                            <input type="checkbox" checked={hasImageModality} onChange={(e) => handleModalityChange(model.id, 'image', e.target.checked)} />
                            <span className="checkbox-visual"></span>
                            <span>Image</span>
                         </label>
                      </div>
                    </Portal>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="form-group">
            <label htmlFor="model">Default Model</label>
            <div className="model-select-wrapper">
            <CustomModelSelector
                models={defaultModelOptions}
                selectedModel={selectedModel}
                onSelect={setSelectedModel}
                disabled={defaultModelOptions.length === 0}
                placeholderText="Select from Quick Access models"
            />
            <Tooltip text={!currentApiKey ? "API Key is required" : "Save credentials & Refresh models" }>
                <button 
                className="refresh-button" 
                onClick={handleManualFetch} 
                disabled={isFetching || !currentApiKey}
                >
                {isFetching ? '...' : <FiRefreshCw size={16} />}
                </button>
            </Tooltip>
            </div>
        </div>
        </>
      )}

      {models.length === 0 && (
         <div className="form-group">
            <label htmlFor="model">Models</label>
            <div className="model-select-wrapper">
                <div className="placeholder-selector">
                    {isFetching ? 'Loading models...' : 'Click Refresh to load available models'}
                </div>
                <Tooltip text={!currentApiKey ? "API Key is required" : "Save credentials & Refresh models" }>
                    <button 
                    className="refresh-button" 
                    onClick={handleManualFetch} 
                    disabled={isFetching || !currentApiKey}
                    >
                    {isFetching ? '...' : <FiRefreshCw size={16} />}
                    </button>
                </Tooltip>
            </div>
            {fetchError && <p className="error-text">{fetchError}</p>}
        </div>
      )}
      
      <div className="modal-actions">
        <button className="modal-button modal-button-cancel" onClick={handleClose}>Cancel</button>
        <button className="modal-button modal-button-save" onClick={handleSave}>Save & Close</button>
      </div>
    </>
    );
  };

  // ... (renderAppearanceTab and the main return statement remain the same) ...
  const renderAppearanceTab = () => (
    <>
      <h3>Appearance</h3>
      <p>Customize the look and feel of the application.</p>
      <div className="form-group">
        <label>Theme</label>
        <div className="theme-options">
          <div className={`theme-card ${theme === 'light' ? 'selected' : ''}`} onClick={() => setTheme('light')} data-theme-name="light">
            <div className="theme-preview">Aa</div>
            <span>Light</span>
          </div>
          <div className={`theme-card ${theme === 'dark' ? 'selected' : ''}`} onClick={() => setTheme('dark')} data-theme-name="dark">
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