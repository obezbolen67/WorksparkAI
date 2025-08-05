import { useState, memo } from 'react'; // Import useEffect
import { FiCpu, FiChevronDown } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../css/InlineThinking.css';

interface InlineThinkingProps {
  content: string | undefined;
  isStreaming?: boolean;
}

const InlineThinking = ({ content, isStreaming = false }: InlineThinkingProps) => {
  // This initializes the state on the first render.
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`inline-thinking-container ${isExpanded ? 'expanded' : ''}`}>
      <button className="thinking-header" onClick={() => setIsExpanded(prev => !prev)}>
        <div className="thinking-status">
          <FiCpu className="thinking-icon" />
          <span className="thinking-text-shimmer">Thinking...</span>
        </div>
        <FiChevronDown className="chevron-icon" />
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