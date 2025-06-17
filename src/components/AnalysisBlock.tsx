// src/components/AnalysisBlock.tsx
import { useState, useMemo, memo } from 'react';
import { FiChevronDown, FiCheckCircle, FiXCircle, FiLoader, FiFileText } from 'react-icons/fi';
import type { Message } from '../types';
import '../css/AnalysisBlock.css';

interface AnalysisBlockProps {
  toolMessage: Message;
  outputMessage?: Message;
}

const AnalysisBlock = memo(({ toolMessage, outputMessage }: AnalysisBlockProps) => {
  // Determine if the block should be expanded by default.
  // It should be expanded during analysis or if there's an error.
  const isInitiallyExpanded = toolMessage.state === 'analyzing' || toolMessage.state === 'error';
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  const state = toolMessage.state || (outputMessage ? 'completed' : 'writing');
  const hasError = state === 'error';

  const { statusText, StatusIcon } = useMemo(() => {
    switch (state) {
      case 'analyzing':
        return { statusText: 'Analyzing document...', StatusIcon: <FiLoader className="spinner-icon" /> };
      case 'error':
        return { statusText: 'Analysis Error', StatusIcon: <FiXCircle /> };
      case 'completed':
        return { statusText: 'Analysis Complete', StatusIcon: <FiCheckCircle /> };
      default: // writing, ready_to_execute
        return { statusText: 'Preparing analysis...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
  }, [state]);

  const output = outputMessage?.content || '';
  const isOutputError = hasError || (state === 'completed' && output.toLowerCase().startsWith('error:'));

  const hasContent = output || state === 'analyzing';
  if (!hasContent) {
    return null; // Don't render the block if there's nothing to show yet
  }

  return (
    <div className={`tool-block-container analysis-container state-${state}`}>
      <button className="tool-block-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="status">
          <div className="status-icon-wrapper">{StatusIcon}</div>
          <span>{statusText}</span>
        </div>
        <FiChevronDown className={`chevron-icon ${isExpanded ? 'expanded' : ''}`} />
      </button>

      <div className={`tool-block-content ${isExpanded ? 'expanded' : ''}`}>
        <div className="analysis-section">
          <div className="section-title">Source Document</div>
          <div className="analysis-source-file">
            <FiFileText size={16} />
            <span className="file-name">{toolMessage.content || '...'}</span>
          </div>
        </div>
        {(output || state === 'analyzing') && (
          <div className="analysis-section">
            <div className="section-title">Result</div>
            {state === 'analyzing' && !output ? (
              <div className="analyzing-placeholder">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
              </div>
            ) : (
              <pre className={`analysis-output-text ${isOutputError ? 'error' : ''}`}>{output}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default AnalysisBlock;