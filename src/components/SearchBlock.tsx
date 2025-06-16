import { useState, useMemo, memo } from 'react';
import { FiChevronDown, FiXCircle, FiLoader, FiSearch } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types';
import '../css/SearchBlock.css';

interface SearchBlockProps {
  toolSearchMessage: Message;
  toolOutputMessage?: Message;
}

const SearchBlock = memo(({ toolSearchMessage, toolOutputMessage }: SearchBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const state = toolSearchMessage.state || (toolOutputMessage ? 'completed' : 'writing');

  const hasError = state === 'error';

  const { statusText, StatusIcon } = useMemo(() => {
    switch (state) {
      case 'searching':
        return { statusText: 'Searching the web...', StatusIcon: <FiLoader className="spinner-icon" /> };
      case 'error':
        return { statusText: 'Search Error', StatusIcon: <FiXCircle /> };
      case 'completed':
      case 'searched':
        return { statusText: 'Web Search', StatusIcon: <FiSearch /> };
      default: // writing, ready_to_execute
        return { statusText: 'Preparing search...', StatusIcon: <FiLoader className="spinner-icon" /> };
    }
  }, [state]);

  const output = toolOutputMessage?.content || '';
  const isOutputError = hasError || (state === 'completed' && output.toLowerCase().startsWith('error:'));

  return (
    <div className={`tool-block-container search-container state-${state}`}>
      <button className="tool-block-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="status">
          <div className="status-icon-wrapper">{StatusIcon}</div>
          <span>{statusText}</span>
        </div>
        <FiChevronDown className={`chevron-icon ${isExpanded ? 'expanded' : ''}`} />
      </button>

      {/* --- START OF THE FIX --- */}
      {/* The content div now gets an "expanded" class based on the component's state */}
      <div className={`tool-block-content ${isExpanded ? 'expanded' : ''}`}>
        <div className="search-section">
          <div className="section-title">Query</div>
          <pre className="search-query-text">
            {toolSearchMessage.content || <span className="streaming-cursor-static"></span>}
          </pre>
        </div>
        {(output || state === 'searching') && (
          <div className="search-section">
            <div className="section-title">Results</div>
            {state === 'searching' && !output ? (
              <div className="searching-placeholder">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
              </div>
            ) : (
              <div className={`search-output-text ${isOutputError ? 'error' : ''}`}>
                 <ReactMarkdown
                   components={{
                      a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
                   }}
                 >
                   {output}
                 </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
      {/* --- END OF THE FIX --- */}
    </div>
  );
});

export default memo(SearchBlock);