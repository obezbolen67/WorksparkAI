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

  return (
    <div className={`image-viewer-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      
      {/* Image Content Wrapper - Transparent, passes clicks through */}
      <div className={`image-viewer-content ${isClosing ? 'closing' : ''}`}>
        <img 
          src={src || ''} 
          alt={alt} 
          onClick={(e) => e.stopPropagation()} /* Only block clicks on the image itself */
        />
      </div>

      {/* Actions Bar - Bottom */}
      <div className="image-viewer-actions" onClick={(e) => e.stopPropagation()}>
        <Tooltip text="Download Image">
          <button className="viewer-action-button" onClick={handleDownload} disabled={!src}>
            <FiDownload size={18} />
            <span>Download</span>
          </button>
        </Tooltip>
        <Tooltip text="Close (Esc)">
          <button className="viewer-action-button close" onClick={handleClose}>
            <FiX size={18} />
            <span>Close</span>
          </button>
        </Tooltip>
      </div>

    </div>
  );
};

export default ImageViewer;