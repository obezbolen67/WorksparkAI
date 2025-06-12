import { useState, memo, useEffect } from 'react'; // Import useEffect
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
  const [isExpanded, setIsExpanded] = useState(isStreaming);

  // --- START OF THE FIX ---
  // This effect hook runs whenever the `isStreaming` prop changes.
  // It ensures the component's internal `isExpanded` state stays
  // in sync with the parent's streaming status.
  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    }
  }, [isStreaming]);
  // --- END OF THE FIX ---

  // When the stream ends, isStreaming becomes false, and the user
  // is free to toggle the box open or closed.
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