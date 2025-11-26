// src/components/SearchBlock.tsx
import { useState, useMemo, memo } from 'react';
import { FiChevronDown, FiXCircle, FiLoader, FiSearch, FiExternalLink } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types';
import '../css/SearchBlock.css';
import { getToolDisplayName } from '../utils/toolLabels';

interface SearchBlockProps {
  toolSearchMessage: Message;
  toolOutputMessage?: Message;
}

type ParsedImage = {
  title: string;
  source: string;
  imageUrl: string;
}

const SearchBlock = memo(({ toolSearchMessage, toolOutputMessage }: SearchBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const state = toolSearchMessage.state || (toolOutputMessage ? 'completed' : 'writing');

  const hasError = state === 'error';
  const name = getToolDisplayName('tool_search');

  const { statusText, StatusIcon, labelClass } = useMemo(() => {
    switch (state) {
      case 'writing':
      case 'ready_to_execute':
        return { 
          statusText: `Calling ${name}...`, 
          StatusIcon: <FiLoader className="spinner-icon" />,
          labelClass: 'animate-shine'
        };
      case 'searching':
        return { 
          statusText: `${name} in progress...`, 
          StatusIcon: <FiLoader className="spinner-icon" />,
          labelClass: 'animate-shine'
        };
      case 'error':
        return { 
          statusText: `${name} Failed`, 
          StatusIcon: <FiXCircle />,
          labelClass: 'error'
        };
      case 'completed':
      case 'searched':
        return { 
          statusText: name, 
          StatusIcon: <FiSearch />,
          labelClass: 'completed' 
        };
      default:
        return { 
          statusText: `Calling ${name}...`, 
          StatusIcon: <FiLoader className="spinner-icon" />,
          labelClass: 'animate-shine'
        };
    }
  }, [state, name]);

  const output = toolOutputMessage?.content || '';
  const isOutputError = hasError || (state === 'completed' && output.toLowerCase().startsWith('error:'));

  const parsedContent = useMemo(() => {
    const images: ParsedImage[] = [];
    let textContent = output;

    if (output && output.includes('[IMAGE_ITEM]')) {
      textContent = '';
      const imageRegex = /\[IMAGE_ITEM\](.*?)\[\/IMAGE_ITEM\]/g;
      const attrRegex = /(\w+)="(.*?)"/g;

      let match;
      while ((match = imageRegex.exec(output)) !== null) {
        const attrsString = match[1];
        const image: Partial<ParsedImage> = {};
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
          // @ts-expect-error Works
          image[attrMatch[1]] = attrMatch[2];
        }
        if(image.imageUrl && image.source && image.title) {
          images.push(image as ParsedImage);
        }
      }
    }
    
    return { images, textContent };
  }, [output]);

  return (
    <div className={`tool-block-container search-container state-${state}`}>
      <button className="tool-block-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="status">
          <div className="status-icon-wrapper">{StatusIcon}</div>
          <span className={`analysis-label ${labelClass}`}>{statusText}</span>
        </div>
        <FiChevronDown className={`chevron-icon ${isExpanded ? 'expanded' : ''}`} />
      </button>
      
      {!isExpanded && parsedContent.images.length > 0 && (
        <div className="tool-block-preview">
          <div className="search-image-gallery-preview">
            {parsedContent.images.slice(0, 4).map((image, index) => (
              <div key={`preview-${index}`} className="search-image-item-preview">
                <img src={image.imageUrl} alt={image.title} />
              </div>
            ))}
          </div>
        </div>
      )}

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
              <>
                {isExpanded && parsedContent.images.length > 0 && (
                  <div className="search-image-gallery">
                    {parsedContent.images.map((image, index) => (
                      <div key={index} className="search-image-item">
                        <img src={image.imageUrl} alt={image.title} />
                        <div className="search-image-info">
                           <div className="search-image-title">{image.title}</div>
                           <a href={image.source} target="_blank" rel="noopener noreferrer" className="search-image-source">
                             Source <FiExternalLink />
                           </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {parsedContent.textContent && (
                   <div className={`search-output-text ${isOutputError ? 'error' : ''}`}>
                    <ReactMarkdown
                      components={{
                          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
                      }}
                    >
                      {parsedContent.textContent}
                    </ReactMarkdown>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default memo(SearchBlock);