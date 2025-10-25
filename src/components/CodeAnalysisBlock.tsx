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

  // --- START OF THE FIX ---
  const handleDownload = async (fileOutput: FileOutput) => {
    try {
      // Fetch the file content from the signed URL
      const response = await fetch(fileOutput.url);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      // Convert the response to a Blob
      const blob = await response.blob();
      
      // Create a temporary local URL for the Blob
      const objectUrl = window.URL.createObjectURL(blob);
      
      // Use the temporary URL to trigger the download
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileOutput.fileName;
      document.body.appendChild(link);
      link.click();
      
      // Clean up by removing the link and revoking the temporary URL
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

    } catch (error) {
      showNotification('Could not download the file.', 'error');
    }
  };
  // --- END OF THE FIX ---

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

  const FilesSection = fileOutputs.length > 0 ? (
    <div className="analysis-section">
      <div className="analysis-section-title">
        File Output{fileOutputs.length > 1 ? 's' : ''} ({fileOutputs.length})
      </div>
      <div className={fileOutputs.length > 1 ? "file-outputs-grid" : ""}>
        {fileOutputs.map((fileOutput, index) => {
          const imageUrl = fileOutput.url;
          const isImage = fileOutput.mimeType.startsWith('image/');
          const isGrid = fileOutputs.length > 1;
          
          return (
            <div key={index} className="file-output-item">
              {isImage ? (
                <div className="image-output-container">
                  <button onClick={() => onView(imageUrl)} className="file-output-image-wrapper">
                    <img src={imageUrl} alt={fileOutput.fileName} className="file-output-image" />
                  </button>
                  <div className="file-output-actions">
                    <Tooltip text={fileOutput.fileName}>
                      <button
                        onClick={() => handleDownload(fileOutput)}
                        className="download-button"
                      >
                        <FiDownload size={14} />
                        {!isGrid && <span>Download</span>}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <div className="file-output-content">
                  <FiFileText size={20} className="file-icon" />
                  <span className="file-name">{fileOutput.fileName}</span>
                  <Tooltip text={fileOutput.fileName}>
                    <button
                      onClick={() => handleDownload(fileOutput)}
                      className="download-button"
                    >
                      <FiDownload size={14} />
                      {!isGrid && <span>Download</span>}
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        })}
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
          {FilesSection}
        </div>
      )}

      {!isExpanded && FilesSection && (
        <div className="analysis-content">
          {FilesSection}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);