// src/components/ConfirmationModal.tsx
import { FiHelpCircle } from 'react-icons/fi';
import '../css/ConfirmationModal.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false
}: ConfirmationModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <FiHelpCircle size={22} className="confirm-modal-icon" />
          <h3>{title}</h3>
        </div>
        <p>{message}</p>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-button cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`confirm-modal-button confirm ${isDestructive ? 'destructive' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;