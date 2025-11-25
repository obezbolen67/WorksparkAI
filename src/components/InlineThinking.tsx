// src/components/InlineThinking.tsx
import { useState, memo } from 'react'; 
import { FiChevronDown } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../css/InlineThinking.css';

interface InlineThinkingProps {
  content: string | undefined;
  isStreaming?: boolean;
}

const InlineThinking = ({ content, isStreaming = false }: InlineThinkingProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`inline-thinking-container ${isExpanded ? 'expanded' : ''}`}>
      <button className="thinking-header" onClick={() => setIsExpanded(prev => !prev)}>
        <div className="thinking-status">
          <span className={`thinking-text-shimmer ${isStreaming ? 'animate' : ''}`}>Thinking</span>
        </div>
        <FiChevronDown className="chevron-icon" size={16} />
      </button>
      <div className="thinking-content-details">
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : null}
        {isStreaming && <span className="streaming-cursor-small"></span>}
      </div>
    </div>
  );
};

export default memo(InlineThinking);