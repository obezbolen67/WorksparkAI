// src/components/ThinkingIndicator.tsx
import { FiCpu } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../css/ThinkingIndicator.css';

interface ThinkingIndicatorProps {
  isThinking: boolean;
  thinkingContent: string | null;
}

const ThinkingIndicator = ({ isThinking, thinkingContent }: ThinkingIndicatorProps) => {
  if (!isThinking) {
    return null;
  }

  // --- START OF THE FIX ---
  // This robust parser handles partially streamed JSON, including potentially
  // malformed streams where JSON objects are concatenated.
  let displayContent = '';
  if (thinkingContent) {
    try {
      // First, try to parse it as complete JSON. This is the ideal case.
      const parsed = JSON.parse(thinkingContent);
      displayContent = parsed.monologue || '';
    } catch (e) {
      // If parsing fails, it might be a partial stream or a malformed one
      // (e.g., concatenated JSON objects).
      // We'll find the last "monologue" key and extract its content from there,
      // which is more reliable than the original greedy regex.
      const lastMonologueKeyIndex = thinkingContent.lastIndexOf('"monologue"');
      if (lastMonologueKeyIndex !== -1) {
        // Find the opening quote of the content, which follows ':"'
        const contentStartIndex = thinkingContent.indexOf(':"', lastMonologueKeyIndex);
        if (contentStartIndex !== -1) {
          // The actual text content starts after the `:"` and the opening `"`
          let rawContent = thinkingContent.substring(contentStartIndex + 2);

          // Defensively remove potential trailing JSON characters from the end of the partial string.
          // This handles cases where the stream ends with `"` or `"}}`.
          if (rawContent.endsWith('"}')) {
            rawContent = rawContent.slice(0, -2);
          } else if (rawContent.endsWith('"')) {
            rawContent = rawContent.slice(0, -1);
          }

          // Unescape common characters for a cleaner display during streaming.
          displayContent = rawContent
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\r/g, '\r');
        }
      }
    }
  }
  // --- END OF THE FIX ---

  return (
    <div className="thinking-indicator-wrapper">
      <div className="thinking-indicator-container">
        <div className="thinking-header">
          <FiCpu className="thinking-icon" />
          <span>Thinking...</span>
        </div>
        {displayContent && (
          <div className="thinking-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayContent}
            </ReactMarkdown>
            <span className="streaming-cursor-small"></span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThinkingIndicator;