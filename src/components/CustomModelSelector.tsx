import { useState, useRef, useEffect, FC } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';
import '../css/CustomModelSelector.css';

type Model = {
  id: string;
};

interface CustomModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  disabled: boolean;
  placeholderText?: string;
}

const CustomModelSelector: FC<CustomModelSelectorProps> = ({ models, selectedModel, onSelect, disabled, placeholderText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const handleSelect = (modelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(modelId);
    setIsOpen(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentModelName = models.find(m => m.id === selectedModel)?.id || selectedModel || placeholderText || 'Select a model';

  return (
    <div className="custom-model-selector" ref={selectorRef}>
      <button 
        className="custom-model-selector-button" 
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
      >
        <span className="selected-model-name">{currentModelName}</span>
        <FiChevronDown size={20} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="custom-model-selector-dropdown">
          {models.length > 0 ? (
            models.map(model => (
              <div 
                key={model.id}
                className={`model-dropdown-item ${selectedModel === model.id ? 'selected' : ''}`}
                onMouseDown={(e) => handleSelect(model.id, e)}
                role="option"
                aria-selected={selectedModel === model.id}
              >
                <span>{model.id}</span>
                {selectedModel === model.id && <FiCheck size={16} className="checkmark-icon" />}
              </div>
            ))
          ) : (
             <div className="model-dropdown-item empty">
                {placeholderText || 'No models available'}
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomModelSelector;