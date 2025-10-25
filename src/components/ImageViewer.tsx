// src/components/ImageViewer.tsx
import { useEffect, useState } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import '../css/ImageViewer.css';
import Tooltip from './Tooltip';
import { useNotification } from '../contexts/NotificationContext';

interface ImageViewerProps {
  src: string | null;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer = ({ src, alt, isOpen, onClose }: ImageViewerProps) => {
  const [isClosing, setIsClosing] = useState(false);
  const { showNotification } = useNotification();

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // --- START OF THE FIX ---
  const handleDownload = async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = alt || 'downloaded-image';
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      showNotification('Could not download the image.', 'error');
    }
  };
  // --- END OF THE FIX ---

  return (
    <div className={`image-viewer-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`image-viewer-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <img src={src || ''} alt={alt} />
      </div>
      <div className="image-viewer-actions">
        <Tooltip text="Download Image">
          <button className="viewer-action-button" onClick={handleDownload} disabled={!src}>
            <FiDownload size={20} />
            <span>Download</span>
          </button>
        </Tooltip>
        <Tooltip text="Close (Esc)">
          <button className="viewer-action-button" onClick={handleClose}>
            <FiX size={20} />
            <span>Close</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default ImageViewer;