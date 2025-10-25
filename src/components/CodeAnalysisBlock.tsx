// src/components/CodeAnalysisBlock.tsx
import { useState, useMemo, memo } from 'react';
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader, FiDownload, FiFileText } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '../contexts/SettingsContext';
import type { Message, FileOutput } from '../types';
import Tooltip from './Tooltip';
import '../css/CodeAnalysisBlock.css';
import { useNotification } from '../contexts/NotificationContext';

interface CodeAnalysisBlockProps {
  chatId: string | null;
  toolCodeMessage: Message;
  toolOutputMessage?: Message;
  onView: (src: string) => void;
}

const CodeAnalysisBlock = ({ toolCodeMessage, toolOutputMessage, onView }: CodeAnalysisBlockProps) => {
  const state = toolCodeMessage.state || 'writing';
  
  const [isExpanded, setIsExpanded] = useState(false);
  const { showNotification } = useNotification();
  const { theme } = useSettings();
  const syntaxTheme = theme === 'light' ? oneLight : vscDarkPlus;

  const code = toolCodeMessage.content || '';
  const hasError = state === 'error';
  const isWriting = state === 'writing';

  const { statusText, StatusIcon } = useMemo(() => {
    if (state === 'writing') {
      return { statusText: 'Processing...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
    if (state === 'ready_to_execute' || state === 'executing') {
      return { statusText: 'Executing...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
    if (hasError) {
      return { statusText: 'Error', StatusIcon: <FiXCircle /> };
    }
    return { statusText: 'Finished', StatusIcon: <FiCheckCircle /> };
  }, [state, hasError]);
  
  const output = toolOutputMessage?.content || '';
  const isOutputError = hasError || (state === 'completed' && output.toLowerCase().includes('error:'));
  
  const fileOutputs = toolOutputMessage?.fileOutputs || [];
  
  // Separate images and regular files
  const imageOutputs = useMemo(() => 
    fileOutputs.filter(f => f.mimeType.startsWith('image/')), 
    [fileOutputs]
  );
  
  const regularFiles = useMemo(() => 
    fileOutputs.filter(f => !f.mimeType.startsWith('image/')), 
    [fileOutputs]
  );

  const handleDownload = async (fileOutput: FileOutput) => {
    try {
      // Use the signed URL directly to avoid CORS issues with fetch()
      const link = document.createElement('a');
      link.href = fileOutput.url;
      link.setAttribute('download', fileOutput.fileName);
      link.rel = 'noopener';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      // Fallback: open in new tab
      try {
        window.open(fileOutput.url, '_blank', 'noopener');
      } catch {
        showNotification('Could not open the file URL.', 'error');
      }
    }
  };

  const OutputSection = (toolOutputMessage || ['completed', 'error'].includes(state)) ? (
    <div className="analysis-section">
      <div className="analysis-section-title">
        {state === 'executing' && !output ? 'Output (Executing...)' : 'Output'}
      </div>
      <pre className={`analysis-output-text ${isOutputError ? 'error' : ''}`}>
        {output || (state === 'executing' ? '' : 'No text output.')}
        {state === 'executing' && !output && <span className="streaming-cursor"></span>}
      </pre>
    </div>
  ) : null;

  const MediaSection = imageOutputs.length > 0 ? (
    <div className="analysis-section">
      <div className="analysis-section-title">
        Media Output{imageOutputs.length > 1 ? 's' : ''} ({imageOutputs.length})
      </div>
      <div className="file-outputs-grid">
        {imageOutputs.map((fileOutput, index) => (
          <div key={index} className="file-output-item">
            <div className="image-output-container">
              <button onClick={() => onView(fileOutput.url)} className="file-output-image-wrapper">
                <img src={fileOutput.url} alt={fileOutput.fileName} className="file-output-image" />
              </button>
              <div className="file-output-actions">
                <Tooltip text={fileOutput.fileName}>
                  <button
                    onClick={() => handleDownload(fileOutput)}
                    className="download-button"
                  >
                    <FiDownload size={14} />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const FilesSection = regularFiles.length > 0 ? (
    <div className="analysis-section">
      <div className="analysis-section-title">
        File Output{regularFiles.length > 1 ? 's' : ''} ({regularFiles.length})
      </div>
      <div className="file-outputs-list">
        {regularFiles.map((fileOutput, index) => (
          <div key={index} className="file-output-item file-item">
            <div className="file-output-content">
              <FiFileText size={20} className="file-icon" />
              <span className="file-name">{fileOutput.fileName}</span>
              <Tooltip text={`Download ${fileOutput.fileName}`}>
                <button
                  onClick={() => handleDownload(fileOutput)}
                  className="download-button"
                >
                  <FiDownload size={14} />
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className={`code-analysis-container ${state} ${isExpanded ? 'expanded' : ''}`}>
      <div className="analysis-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="status">
          {StatusIcon}
          <span>{statusText}</span>
        </div>
        <FiChevronDown className="chevron-icon" />
      </div>

      {isExpanded && (
        <div className="analysis-content">
          <div className="analysis-section">
            <div className="analysis-section-title">Code</div>
            <div className="code-wrapper">
              {code ? (
                <SyntaxHighlighter
                  style={syntaxTheme}
                  language="python"
                  PreTag="div"
                >
                  {code}
                </SyntaxHighlighter>
              ) : (
                <div className="code-placeholder">
                  <pre className="analysis-output-text">
                    {isWriting && <span className="streaming-cursor"></span>}
                  </pre>
                </div>
              )}
            </div>
          </div>
          {OutputSection}
          {MediaSection}
          {FilesSection}
        </div>
      )}

      {!isExpanded && (MediaSection || FilesSection) && (
        <div className="analysis-content">
          {MediaSection}
          {FilesSection}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);