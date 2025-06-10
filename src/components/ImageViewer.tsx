// src/components/ImageViewer.tsx
import { useEffect } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import '../css/ImageViewer.css';
import Tooltip from './Tooltip'; // <-- ADDED

interface ImageViewerProps {
  src: string | null;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer = ({ src, alt, isOpen, onClose }: ImageViewerProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = alt || 'downloaded-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} />
      </div>
      <div className="image-viewer-actions">
        <Tooltip text="Download Image">
          <button className="viewer-action-button" onClick={handleDownload}>
            <FiDownload size={20} />
            <span>Download</span>
          </button>
        </Tooltip>
        <Tooltip text="Close (Esc)">
          <button className="viewer-action-button" onClick={onClose}>
            <FiX size={20} />
            <span>Close</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default ImageViewer;