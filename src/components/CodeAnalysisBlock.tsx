// src/components/CodeAnalysisBlock.tsx

import { useState, useMemo, memo, useEffect } from 'react';
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
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
                {output || (state === 'executing' ? '' : 'No output.')}
                {state === 'executing' && !output && <span className="streaming-cursor"></span>}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);