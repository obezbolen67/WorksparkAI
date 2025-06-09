// src/components/RenameModal.tsx
import { useState, useEffect } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import '../css/RenameModal.css';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newTitle: string) => void;
  currentTitle: string;
}

const RenameModal = ({ isOpen, onClose, onRename, currentTitle }: RenameModalProps) => {
  const [newTitle, setNewTitle] = useState(currentTitle);

  useEffect(() => {
    if (isOpen) {
      setNewTitle(currentTitle);
    }
  }, [isOpen, currentTitle]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (newTitle.trim() && newTitle.trim() !== currentTitle) {
      onRename(newTitle.trim());
    }
    onClose();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="rename-modal-overlay" onClick={onClose}>
      <div className="rename-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="rename-modal-header">
          <FiEdit2 size={20} className="rename-modal-icon" />
          <h3>Rename Chat?</h3>
        </div>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        <div className="rename-modal-actions">
          <button className="rename-modal-button cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="rename-modal-button save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;