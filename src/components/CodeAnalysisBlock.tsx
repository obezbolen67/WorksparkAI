// src/components/CodeAnalysisBlock.tsx

import { useState, useMemo, memo, useEffect } from 'react';
// --- START OF THE FIX: Import new icons ---
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader, FiDownload, FiFileText } from 'react-icons/fi';
// --- END OF THE FIX ---
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '../contexts/SettingsContext';
import type { Message } from '../types';
import '../css/CodeAnalysisBlock.css';

interface CodeAnalysisBlockProps {
  toolCodeMessage: Message;
  toolOutputMessage?: Message;
}

const CodeAnalysisBlock = ({ toolCodeMessage, toolOutputMessage }: CodeAnalysisBlockProps) => {
  const state = toolCodeMessage.state || 'writing';
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useSettings();
  const syntaxTheme = theme === 'light' ? oneLight : vscDarkPlus;

  useEffect(() => {
    // Keep it expanded if it's writing, executing or has an error
    if (state === 'writing' || state === 'executing' || state === 'error') {
      setIsExpanded(true);
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
  
  // --- START OF THE FIX ---
  // Check for file output and prepare the data URL for download
  const fileOutput = toolOutputMessage?.fileOutput;
  const dataUrl = fileOutput
    ? `data:${fileOutput.mimeType};base64,${fileOutput.content}`
    : null;
  // --- END OF THE FIX ---

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
          {(toolOutputMessage || ['executing', 'completed', 'error'].includes(state)) && (
            <div className="analysis-section">
              <div className="analysis-section-title">
                {state === 'executing' && !output ? 'Output (Executing...)' : 'Output'}
              </div>
              <pre className={`analysis-output-text ${isOutputError ? 'error' : ''}`}>
                {output || (state === 'executing' ? '' : 'No text output.')}
                {state === 'executing' && !output && <span className="streaming-cursor"></span>}
              </pre>
            </div>
          )}
          {/* --- START OF THE FIX --- */}
          {fileOutput && dataUrl && (
             <div className="analysis-section">
                <div className="analysis-section-title">File Output</div>
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
             </div>
          )}
          {/* --- END OF THE FIX --- */}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);