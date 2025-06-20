// src/components/SuspensionInfoModal.tsx
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import '../css/SuspensionInfoModal.css';

interface SuspensionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SuspensionInfoModal = ({ isOpen, onClose }: SuspensionInfoModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="suspension-modal-overlay" onClick={onClose}>
      <div className="suspension-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="suspension-modal-header">
          <FiAlertTriangle size={22} className="suspension-modal-icon" />
          <h3>Account Status Update</h3>
          <button className="suspension-modal-close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>
        <div className="suspension-modal-body">
          <p>
            Today i was checking my freelancer account, and i couldn't log in. after some tries i found out that my account was suspended by admins, probably when i tried submitting my personal info (documents), something was wrong or incorrect for service, but i'm trying to restore my account.
          </p>
          <p>
            That message is only visible to you. App won't stop working and i'll still work with you despite suspensions, i hope it's temporary issue.
          </p>
          <p>
            For contact, please use my email <a href="mailto:miacc9576@gmail.com">miacc9576@gmail.com</a>
          </p>
        </div>
        <div className="suspension-modal-actions">
          <button className="suspension-modal-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuspensionInfoModal;