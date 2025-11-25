// src/contexts/SidePanelContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

type SidePanelType = 'sources' | 'html_preview' | null;

interface SidePanelContextType {
  isOpen: boolean;
  panelType: SidePanelType;
  panelData: any;
  openPanel: (type: SidePanelType, data: any) => void;
  closePanel: () => void;
}

const SidePanelContext = createContext<SidePanelContextType | undefined>(undefined);

export const SidePanelProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelType, setPanelType] = useState<SidePanelType>(null);
  const [panelData, setPanelData] = useState<any>(null);

  const openPanel = (type: SidePanelType, data: any) => {
    setPanelType(type);
    setPanelData(data);
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
    setPanelType(null);
    setPanelData(null);
  };

  return (
    <SidePanelContext.Provider value={{ isOpen, panelType, panelData, openPanel, closePanel }}>
      {children}
    </SidePanelContext.Provider>
  );
};

export const useSidePanel = () => {
  const context = useContext(SidePanelContext);
  if (context === undefined) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return context;
};