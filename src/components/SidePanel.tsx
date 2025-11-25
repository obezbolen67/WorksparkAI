// src/components/SidePanel.tsx
import { useEffect, useState, useCallback } from 'react';
import { FiX, FiExternalLink } from 'react-icons/fi';
import { useSidePanel } from '../contexts/SidePanelContext';
import Portal from './Portal';
import '../css/SidePanel.css';

const SidePanel = () => {
  const { isOpen, closePanel, panelType, panelData } = useSidePanel();
  const [isClosing, setIsClosing] = useState(false);

  // Handle the closing sequence: animate first, then update context to unmount
  const handleClose = useCallback(() => {
    if (isClosing) return; // Prevent double triggering
    setIsClosing(true);
    setTimeout(() => {
      closePanel();
      setIsClosing(false);
    }, 300); // Match the CSS animation duration (0.3s)
  }, [closePanel, isClosing]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const renderSources = () => (
    <div className="side-panel-content">
      <div className="side-panel-header">
        <h3>Sources</h3>
        <button onClick={handleClose} className="close-panel-btn"><FiX size={20} /></button>
      </div>
      <div className="sources-list">
        {panelData?.sources?.map((source: any, index: number) => (
          <a key={index} href={source.url} target="_blank" rel="noopener noreferrer" className="source-card">
            <div className="source-card-header">
              <div className="source-favicon">
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`} 
                  alt="favicon" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) parent.innerHTML = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>'; 
                  }} 
                />
              </div>
              <span className="source-title">{source.title}</span>
            </div>
            <div className="source-snippet">{source.snippet}</div>
            <div className="source-url">
              {new URL(source.url).hostname} <FiExternalLink size={12} />
            </div>
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <Portal>
      <div 
        className={`side-panel-overlay ${isClosing ? 'closing' : ''}`} 
        onClick={handleClose}
      ></div>
      <div className={`side-panel-container ${isClosing ? 'closing' : ''}`}>
        {panelType === 'sources' && renderSources()}
      </div>
    </Portal>
  );
};

export default SidePanel;