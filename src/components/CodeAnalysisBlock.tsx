// src/components/CodeAnalysisBlock.tsx

import { useState, useMemo, memo, useEffect } from 'react';
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader, FiCode } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useSettings } from '../contexts/SettingsContext';
import type { Message } from '../types';
import '../css/CodeAnalysisBlock.css';

interface CodeAnalysisBlockProps {
  toolCodeMessage: Message;
  toolOutputMessage?: Message;
  isStreaming?: boolean;
}

const CodeAnalysisBlock = ({ toolCodeMessage, toolOutputMessage, isStreaming = false }: CodeAnalysisBlockProps) => {
  const state = toolCodeMessage.state || 'completed';
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useSettings();
  const syntaxTheme = theme === 'light' ? oneLight : vscDarkPlus;

  useEffect(() => {
    if (state === 'processing' || state === 'executing' || state === 'error') {
      setIsExpanded(true);
    }
  }, [state]);

  const toolCall = toolCodeMessage.tool_calls?.[0];
  let code = '';
  
  if (toolCall) {
    let rawArgs = toolCall.function.arguments || '';
    
    // --- START OF THE POLISHING FIX ---
    // This is the final, most robust parser.
    
    // 1. Find the last occurrence of the code key pattern `:"` which separates the key from the value.
    const lastCodeKeyIndex = rawArgs.lastIndexOf('code"');
    if (lastCodeKeyIndex !== -1) {
      const separatorIndex = rawArgs.indexOf(':"', lastCodeKeyIndex);
      
      if (separatorIndex !== -1) {
        // 2. The raw content starts 2 characters after the separator.
        let rawContent = rawArgs.slice(separatorIndex + 2);

        // 3. Clean up potential trailing JSON characters.
        if (rawContent.endsWith('"')) {
          rawContent = rawContent.slice(0, -1);
        }
        if (rawContent.endsWith('}')) {
          rawContent = rawContent.slice(0, -1);
        }
         if (rawContent.endsWith('}')) {
          rawContent = rawContent.slice(0, -1);
        }

        // 4. Unescape the final, clean content for display.
        code = rawContent
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\r/g, '\r');
      }
    }
    // --- END OF THE POLISHING FIX ---
  }

  const hasError = state === 'error';
  const isActivelyProcessing = isStreaming && (state === 'processing' || state === 'executing');
  const isCodeStreaming = isStreaming && state === 'processing';

  const { statusText, StatusIcon } = useMemo(() => {
    if (state === 'processing') {
      return { statusText: 'Writing code...', StatusIcon: <FiCode className="processing-icon" /> };
    }
    if (state === 'executing') {
       return { statusText: 'Executing...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
    if (hasError) {
      return { statusText: 'Error', StatusIcon: <FiXCircle /> };
    }
    return { statusText: 'Code Executed', StatusIcon: <FiCheckCircle /> };
  }, [state, hasError]);

  if (!toolCall) return null;
  
  const output = toolOutputMessage?.content || '';
  const isOutputError = hasError || (state === 'completed' && output.toLowerCase().includes('error:'));
  const isOutputStreaming = isActivelyProcessing && state === 'executing' && toolOutputMessage && !output;

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
              <SyntaxHighlighter
                style={syntaxTheme}
                language="python"
                PreTag="div"
              >
                {code || '# No code to display'}
              </SyntaxHighlighter>
              {isCodeStreaming && <span className="streaming-cursor code"></span>}
            </div>
          </div>
          {(toolOutputMessage || state === 'executing') && (
            <div className="analysis-section">
              <div className="analysis-section-title">
                {state === 'executing' && !output ? 'Output (Executing...)' : 'Output'}
              </div>
              <pre className={`analysis-output-text ${isOutputError ? 'error' : ''}`}>
                {output || (state === 'executing' ? '' : 'No output.')}
                {isOutputStreaming && <span className="streaming-cursor"></span>}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);