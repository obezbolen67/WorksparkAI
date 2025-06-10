// src/components/MobileHeader.tsx
import { FiMenu, FiEdit } from 'react-icons/fi';
import ModelSelector from './ModelSelector';
import '../css/MobileHeader.css';

interface MobileHeaderProps {
  onToggleSidebar: () => void;
  onNewChat: () => void;
}

const MobileHeader = ({ onToggleSidebar, onNewChat }: MobileHeaderProps) => {
  return (
    <header className="mobile-header">
      <button className="mobile-header-button" onClick={onToggleSidebar} aria-label="Open menu">
        <FiMenu size={22} />
      </button>
      
      {/* The static title is now replaced by the interactive ModelSelector */}
      <ModelSelector />
      
      <button className="mobile-header-button" onClick={onNewChat} aria-label="New chat">
        <FiEdit size={22} />
      </button>
    </header>
  );
};

export default MobileHeader;