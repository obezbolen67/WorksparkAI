// src/components/AnalysisBlock.tsx
import { useState, useMemo, memo } from 'react';
import { FiChevronDown, FiCheck, FiFileText, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import type { Message } from '../types';
import '../css/AnalysisBlock.css';

interface AnalysisBlockProps {
  toolMessage: Message;
  outputMessage?: Message;
}

const AnalysisBlock = memo(({ toolMessage, outputMessage }: AnalysisBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const state = toolMessage.state || (outputMessage ? 'completed' : 'writing');
  const hasError = state === 'error';
  const filename = toolMessage.content || 'document';

  const { statusText, labelClass } = useMemo(() => {
    switch (state) {
      case 'analyzing':
      case 'writing':
      case 'ready_to_execute':
        return { statusText: 'Reading document...', labelClass: 'animate-shine' };
      case 'error':
        return { statusText: 'Failed to read document', labelClass: 'error' };
      case 'completed':
        return { statusText: 'Document Read', labelClass: 'completed' };
      default:
        return { statusText: 'Analysis', labelClass: '' };
    }
  }, [state]);

  return (
    <div className={`analysis-container ${state} ${isExpanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="analysis-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="analysis-header-content">
          <div className="analysis-header-left">
            <span className={`analysis-label ${labelClass}`}>{statusText}</span>
          </div>
          <FiChevronDown className="chevron-icon" />
        </div>
      </div>

      {/* Expanded Content: Just the file card, no raw text results */}
      {isExpanded && (
        <div className="analysis-content">
          <div className="analysis-file-card">
            <div className="file-icon-box">
              {hasError ? <FiAlertTriangle size={18} /> : <FiFileText size={18} />}
            </div>
            <div className="file-info">
              <span className="file-name">{filename}</span>
              <span className="file-status">
                {hasError ? 'Extraction failed' : 'Content extracted to context'}
              </span>
            </div>
            {!hasError && <FiCheck className="file-check-icon" size={16} />}
          </div>
          
          {/* Only show error details if present */}
          {hasError && outputMessage?.content && (
             <div className="analysis-error-details">
               {outputMessage.content}
             </div>
          )}
        </div>
      )}
    </div>
  );
});

export default AnalysisBlock;