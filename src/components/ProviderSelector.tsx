import { useState, useRef, useEffect, type FC, type SVGProps } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import '../css/ProviderSelector.css';

export type Provider = {
  id: string;
  name: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
};

interface ProviderSelectorProps {
  providers: Provider[];
  selectedProvider: string;
  onSelect: (providerId: string) => void;
}

const ProviderSelector: FC<ProviderSelectorProps> = ({ providers, selectedProvider, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const currentProvider = providers.find(p => p.id === selectedProvider) || providers[0];

  const handleSelect = (providerId: string) => {
    onSelect(providerId);
    setIsOpen(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="provider-selector" ref={selectorRef}>
      <button className="provider-selector-button" onClick={() => setIsOpen(!isOpen)}>
        <div className="provider-info">
          <currentProvider.Icon className="provider-icon" />
          <span>{currentProvider.name}</span>
        </div>
        <FiChevronDown size={20} className={`chevron-icon ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="provider-selector-dropdown">
          {providers.map(provider => (
            <div 
              key={provider.id}
              className={`provider-item ${selectedProvider === provider.id ? 'selected' : ''}`}
              onClick={() => handleSelect(provider.id)}
            >
              <provider.Icon className="provider-icon" />
              <span>{provider.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderSelector;