// src/components/CodeAnalysisBlock.tsx

import { useState, useMemo, memo, useEffect } from 'react';
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader, FiDownload, FiFileText } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '../contexts/SettingsContext';
import type { Message } from '../types';
import '../css/CodeAnalysisBlock.css';

// --- START OF THE FIX (1/2) ---
interface CodeAnalysisBlockProps {
  chatId: string | null;
  toolCodeMessage: Message;
  toolOutputMessage?: Message;
  onView: (src: string) => void; // Add the onView prop
}

const CodeAnalysisBlock = ({ toolCodeMessage, toolOutputMessage, onView }: CodeAnalysisBlockProps) => {
// --- END OF THE FIX (1/2) ---
  const state = toolCodeMessage.state || 'writing';
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useSettings();
  const syntaxTheme = theme === 'light' ? oneLight : vscDarkPlus;

  useEffect(() => {
    if (state === 'writing' || state === 'executing' || state === 'error') {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [state]);

  const code = toolCodeMessage.content || '';
  const hasError = state === 'error';
  const isWriting = state === 'writing';

  const { statusText, StatusIcon } = useMemo(() => {
    if (state === 'writing') {
      return { statusText: 'Writing code...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
    if (state === 'ready_to_execute' || state === 'executing') {
      return { statusText: 'Executing...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
    if (hasError) {
      return { statusText: 'Error', StatusIcon: <FiXCircle /> };
    }
    return { statusText: 'Code Executed', StatusIcon: <FiCheckCircle /> };
  }, [state, hasError]);
  
  const output = toolOutputMessage?.content || '';
  const isOutputError = hasError || (state === 'completed' && output.toLowerCase().includes('error:'));
  
  const fileOutput = toolOutputMessage?.fileOutput;
  const dataUrl = fileOutput
    ? `data:${fileOutput.mimeType};base64,${fileOutput.content}`
    : null;

  const isImage = fileOutput?.mimeType.startsWith('image/');

  const OutputSection = (toolOutputMessage || ['executing', 'completed', 'error'].includes(state)) ? (
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

  // --- START OF THE FIX (2/2) ---
  const FileSection = fileOutput && dataUrl ? (
     <div className="analysis-section">
        <div className="analysis-section-title">File Output</div>
        {isImage ? (
          // Make the wrapper a button and call `onView` when clicked
          <button onClick={() => onView(dataUrl)} className="file-output-image-wrapper">
            <img src={dataUrl} alt={fileOutput.fileName} className="file-output-image" />
          </button>
        ) : (
          <div className="file-output-content">
            <FiFileText size={18} className="file-icon" />
            <span className="file-name">{fileOutput.fileName}</span>
            <a 
              href={dataUrl} 
              download={fileOutput.fileName}
              className="download-button"
            >
              <FiDownload size={16} />
              <span>Download</span>
            </a>
          </div>
        )}
     </div>
  ) : null;
  // --- END OF THE FIX (2/2) ---

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
                  customStyle={{
                    maxWidth: '100%',
                    overflow: 'auto',
                  }}
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
              {isWriting && code && (
                <div className="code-streaming-indicator">
                  <span className="streaming-cursor"></span>
                </div>
              )}
            </div>
          </div>
          {OutputSection}
          {FileSection}
        </div>
      )}

      {!isExpanded && (OutputSection || FileSection) && (
        <div className="analysis-content">
          {OutputSection}
          {FileSection}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);