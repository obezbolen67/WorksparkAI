// src/components/ImageViewer.tsx
import { useEffect, useState } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import '../css/ImageViewer.css';
import Tooltip from './Tooltip';

interface ImageViewerProps {
  src: string | null;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageViewer = ({ src, alt, isOpen, onClose }: ImageViewerProps) => {
  const [isClosing, setIsClosing] = useState(false);

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
  }, [isOpen, onClose]);

  // This guard clause is what makes the fix below safe.
  if (!isOpen) return null;

  const handleDownload = () => {
    // The `!src` check is technically redundant because of the guard clause,
    // but it's good practice for event handlers.
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = alt || 'downloaded-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`image-viewer-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`image-viewer-content ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* --- START OF THE FIX --- */}
        {/* We use `src || ''` to satisfy TypeScript. If `src` is null, it provides an
            empty string. However, the `if (!isOpen)` guard already prevents this
            component from rendering when the `src` is likely to be null. */}
        <img src={src || ''} alt={alt} />
        {/* --- END OF THE FIX --- */}
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