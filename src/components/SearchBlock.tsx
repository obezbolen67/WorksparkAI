// src/components/CodeAnalysisBlock.tsx

import { useState, useMemo, memo, useEffect } from 'react';
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader, FiDownload, FiFileText } from 'react-icons/fi';
import type { Message } from '../types';
import Tooltip from './Tooltip';
import '../css/SearchBlock.css';

interface SearchBlockProps {
  chatId: string | null;
  toolSearchMessage: Message;
  toolOutputMessage?: Message;
  onView: (src: string) => void;
}

const SearchBlock = ({ toolSearchMessage, toolOutputMessage, onView }: SearchBlockProps) => {
  const state = toolSearchMessage.state || 'writing';
  const [isSearched, setIsSearched] = useState(false);

  useEffect(() => {
    if (state === 'searching' || state === 'error') {
      setIsSearched(false);
    } else {
      setIsSearched(true);
    }
  }, [state]);
  const hasError = state === 'error';
  const isSearching = state === 'searching';

  const { statusText, StatusIcon } = useMemo(() => {
    if (state === 'searching') {
      return { statusText: 'Searching...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
    if (hasError) {
      return { statusText: 'Error', StatusIcon: <FiXCircle /> };
    }
    return { statusText: 'Searched', StatusIcon: <FiCheckCircle /> };
  }, [state, hasError]);
  
  const output = toolOutputMessage?.content || '';
  const isOutputError = hasError || (state === 'searched' && output.toLowerCase().includes('error:'));
  
  const fileOutput = toolOutputMessage?.fileOutput;
  const dataUrl = fileOutput
    ? `data:${fileOutput.mimeType};base64,${fileOutput.content}`
    : null;

  const isImage = fileOutput?.mimeType.startsWith('image/');

  // --- START OF THE FIX ---
  // A helper function to programmatically trigger a file download.
  const handleDownload = () => {
    if (!dataUrl || !fileOutput) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileOutput.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // --- END OF THE FIX ---

  const OutputSection = (toolOutputMessage || ['searching', 'searched', 'error'].includes(state)) ? (
    <div className="search-section">
      <div className="search-section-title">
        {state === 'searching' && !output ? 'Searching...' : 'Searched.'}
      </div>
      <pre className={`search-output-text ${isOutputError ? 'error' : ''}`}>
        {output || (state === 'searching' ? '' : 'No data.')}
        {state === 'searching' && !output && <span className="streaming-cursor"></span>}
      </pre>
    </div>
  ) : null;

  const FileSection = fileOutput && dataUrl ? (
     <div className="search-section">
        <div className="search-section-title">File Output</div>
        {isImage ? (
          <div className="image-output-container">
            <button onClick={() => onView(dataUrl)} className="file-output-image-wrapper">
              <img src={dataUrl} alt={fileOutput.fileName} className="file-output-image" />
            </button>
            <div className="file-output-actions">
              <Tooltip text={fileOutput.fileName}>
                {/* --- START OF THE FIX --- */}
                {/* Replaced <a> tag with a <button> to prevent default tooltips */}
                <button
                  onClick={handleDownload}
                  className="download-button"
                >
                  <FiDownload size={14} />
                  <span>Download</span>
                </button>
                {/* --- END OF THE FIX --- */}
              </Tooltip>
            </div>
          </div>
        ) : (
          <div className="file-output-content">
            <FiFileText size={20} className="file-icon" />
            <span className="file-name">{fileOutput.fileName}</span>
            <Tooltip text={fileOutput.fileName}>
              {/* --- START OF THE FIX --- */}
              {/* Also replaced this <a> tag with a <button> */}
              <button
                onClick={handleDownload}
                className="download-button"
              >
                <FiDownload size={14} />
                <span>Download</span>
              </button>
              {/* --- END OF THE FIX --- */}
            </Tooltip>
          </div>
        )}
     </div>
  ) : null;

  return (
    <div className={`search-container ${state} ${isSearching ? 'searching' : ''}`}>
      <div className="search-header">
        <div className="status">
          {StatusIcon}
          <span>{statusText}</span>
        </div>
        <FiChevronDown className="chevron-icon" />
      </div>

      {!isSearched && (OutputSection || FileSection) && (
        <div className="search-content">
          {OutputSection}
          {FileSection}
        </div>
      )}
    </div>
  );
};

export default memo(SearchBlock);