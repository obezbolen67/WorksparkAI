// src/components/ChatMessage.tsx

import { useState, useEffect, useRef, memo } from 'react';
import type { Message, Attachment } from '../types';
import api from '../utils/api';
import '../css/ChatMessage.css';
import { FiCopy, FiRefreshCw, FiEdit, FiCheck } from 'react-icons/fi';
import ImageViewer from './ImageViewer';
import Tooltip from './Tooltip';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CodeAnalysisBlock from './CodeAnalysisBlock';

interface CodeComponentProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  [key: string]: any;
}

const useTheme = () => {
    const [theme, setTheme] = useState(
        () => document.documentElement.getAttribute('data-theme') || 'dark'
    );

    useEffect(() => {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
                    setTheme(newTheme);
                    break;
                }
            }
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    return theme;
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Clipboard API failed, falling back to execCommand.", err);
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    return successful;
  } catch (err) {
    console.error("Fallback to execCommand failed.", err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

const CustomCode = ({ node, inline, className, children, style, ...props }: CodeComponentProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const theme = useTheme();
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  const syntaxHighlighterStyle = theme === 'light' ? oneLight : vscDarkPlus;

  const handleCopy = async () => {
    const success = await copyTextToClipboard(codeString);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      alert("Failed to copy to clipboard.");
    }
  };

  if (!inline && match) {
    return (
      <div className="code-block-wrapper">
        <div className="code-block-header">
          <span className="language-name">{match[1]}</span>
          <button onClick={handleCopy} className="copy-code-button">
            {isCopied ? <FiCheck size={16} /> : <FiCopy size={16} />}
            <span>{isCopied ? 'Copied!' : 'Copy code'}</span>
          </button>
        </div>
        <SyntaxHighlighter
          style={syntaxHighlighterStyle}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  
  return (
    <code className={className} style={style} {...props}>
      {children}
    </code>
  );
};

const Paragraph: Components['p'] = ({ node, ...props }) => {
    const child = node?.children[0];
    if (
        node?.children.length === 1 &&
        child?.type === 'element' &&
        (child?.tagName === 'pre' || 
         (child?.tagName === 'div' && typeof child.properties?.className === 'string' && child.properties.className.includes('code-analysis-container')))
    ) {
        return <>{props.children}</>;
    }
    return <p {...props} />;
};

const AuthenticatedImage = ({ chatId, attachment, onView }: { chatId: string, attachment: Attachment, onView: (src: string) => void }) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const apiEndpoint = attachment._id ? `/files/view/${chatId}/${attachment._id}` : null;

    useEffect(() => {
        if (!apiEndpoint) {
            setObjectUrl(null);
            setHasError(false);
            return;
        }

        let isMounted = true;
        let tempUrl: string | null = null;
      
        setHasError(false);
        setObjectUrl(null);

        const fetchImage = async () => {
            try {
                const response = await api(apiEndpoint);
                if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                const blob = await response.blob();
                if (isMounted) {
                    tempUrl = URL.createObjectURL(blob);
                    setObjectUrl(tempUrl);
                }
            } catch (error) {
                console.error(`Failed to load authenticated image for ${attachment.fileName}:`, error);
                if (isMounted) setHasError(true);
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
            if (tempUrl) URL.revokeObjectURL(tempUrl);
        };
    }, [apiEndpoint, attachment.fileName]);

    const handleViewClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (objectUrl) {
        onView(objectUrl);
      }
    };

    if (hasError) return <div className="attachment-image-wrapper error"><span>Error Loading Image</span></div>;
    if (!objectUrl) return <div className="attachment-image-wrapper loading" />;

    return (
        <a href={objectUrl} onClick={handleViewClick} className="attachment-image-wrapper">
            <img src={objectUrl} alt={attachment.fileName} />
        </a>
    );
};

interface ChatMessageProps {
  message: Message;
  messages: Message[];
  chatId: string | null;
  index: number;
  isEditing: boolean;
  isStreaming: boolean;
  onRegenerate: () => void;
  onCopy: (content: string) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onCancelEdit: () => void;
}

const ChatMessage = ({ message, messages, chatId, index, isEditing, isStreaming, onRegenerate, onCopy, onStartEdit, onSaveEdit, onCancelEdit }: ChatMessageProps) => {
  const [editedContent, setEditedContent] = useState(message.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [initialDimensions, setInitialDimensions] = useState<{ width: number; height: number } | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerAlt, setViewerAlt] = useState('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  
  useEffect(() => {
    if (isEditing) {
      setEditedContent(message.content || '');
      if (messageContentRef.current && bubbleRef.current) {
        setInitialDimensions({
          width: bubbleRef.current.getBoundingClientRect().width,
          height: messageContentRef.current.getBoundingClientRect().height
        });
      }
    } else {
      setInitialDimensions(null);
    }
  }, [isEditing, message.content]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (isEditing && textarea) {
      if (initialDimensions) {
        textarea.style.height = `${initialDimensions.height}px`;
      }
      setTimeout(() => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 200;
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }, 300);
    }
  }, [editedContent, isEditing, initialDimensions]);

  const handleOpenViewer = (src: string, alt: string) => {
    setViewerSrc(src);
    setViewerAlt(alt);
    setIsViewerOpen(true);
  };

  const renderAttachments = (attachments: Attachment[]) => (
    <div className="message-attachments">
      {attachments.map(att => {
        if (!chatId) return null;
        const attachmentKey = att._id || att.gcsObjectName;
        if (att.mimeType.startsWith('image/')) {
          return <AuthenticatedImage 
                    key={attachmentKey} 
                    chatId={chatId} 
                    attachment={att} 
                    onView={(src) => handleOpenViewer(src, att.fileName)} 
                 />;
        }

        const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            try {
                if (!att._id) {
                    alert("File is still processing. Please wait a moment.");
                    return;
                }
                const response = await api(`/files/view/${chatId}/${att._id}`);
                if (!response.ok) throw new Error('Download failed');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = att.fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                console.error("File download error:", err);
                alert('Could not download file.');
            }
        };
      
        return (
          <a key={attachmentKey} href="#" onClick={handleDownload} className="attachment-file-link">
            {att.fileName}
          </a>
        );
      })}
    </div>
  );

  // --- START OF THE FIX: AGGRESSIVE HIDING LOGIC ---
  // A message should NOT render itself if it's a part of a larger turn that will be rendered by a preceding "turn starter" message.
  const prevMessage = messages[index - 1];
  if (
    // Hide all tool-related messages. They are always rendered by an assistant message.
    message.role === 'tool' ||
    message.role === 'tool_code' ||
    // Hide an assistant message if it's a "continuation" or "summary" that follows a tool call.
    // The "turn starter" assistant message will render it instead.
    (message.role === 'assistant' && prevMessage?.role === 'tool')
  ) {
    return null;
  }
  // --- END OF THE FIX ---
  
  if (message.role === 'user') {
    return (
      <>
        <div className={`chat-message-wrapper user ${isEditing ? 'editing' : ''}`}>
          <div className="chat-message-container">
            <div
              ref={bubbleRef}
              className="user-message-bubble"
              style={isEditing && initialDimensions ? {
                '--initial-width': `${initialDimensions.width}px`,
                '--initial-height': `${initialDimensions.height}px`
              } as React.CSSProperties : undefined}
            >
              {!isEditing ? (
                <div ref={messageContentRef} className="message-content">
                  {message.attachments && message.attachments.length > 0 && renderAttachments(message.attachments)}
                  {message.content && <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CustomCode, p: Paragraph }}>{message.content}</ReactMarkdown>}
                  {!message.content && (!message.attachments || message.attachments.length === 0) && '\u00A0'}
                </div>
              ) : (
                <div className="message-editor-content">
                  <textarea
                    ref={textareaRef}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(index, editedContent); }
                      if (e.key === 'Escape') { onCancelEdit(); }
                    }}
                    rows={1}
                  />
                  <div className="editor-actions">
                    <button className="editor-button cancel" onClick={onCancelEdit}>Cancel</button>
                    <button className="editor-button save" onClick={() => onSaveEdit(index, editedContent)}>Save & Submit</button>
                  </div>
                </div>
              )}
            </div>
            {message.content && !isEditing && (
              <div className="message-actions">
                <Tooltip text="Edit">
                  <button className="action-button" onClick={() => onStartEdit(index)}>
                    <FiEdit size={16} />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      
        <ImageViewer 
          isOpen={isViewerOpen}
          src={viewerSrc}
          alt={viewerAlt}
          onClose={() => setIsViewerOpen(false)}
        />
      </>
    );
  }

  if (message.role === 'assistant') {
      // --- START OF THE FIX: Unified Turn Rendering ---
      const turnParts: React.ReactNode[] = [];
      const textParts: string[] = [];
      let lastMessageInTurnIndex = index;

      // This loop iterates through the entire multi-step turn, collecting all parts.
      let currentIndex = index;
      while (currentIndex < messages.length) {
          const currentMessage = messages[currentIndex];

          // 1. Add the assistant's text content.
          if (currentMessage.role === 'assistant' && currentMessage.content) {
              textParts.push(currentMessage.content);
              turnParts.push(
                  <ReactMarkdown key={`text-${currentIndex}`} remarkPlugins={[remarkGfm]} components={{ code: CustomCode, p: Paragraph }}>
                      {currentMessage.content}
                  </ReactMarkdown>
              );
          }

          // 2. Check for a following tool call.
          const nextMessage = messages[currentIndex + 1];
          if (nextMessage && nextMessage.role === 'tool_code') {
              const toolCodeMessage = nextMessage;
              const toolOutputMessage = messages.find(m => m.role === 'tool' && m.tool_id === toolCodeMessage.tool_id);
              
              turnParts.push(
                  <CodeAnalysisBlock 
                      key={`code-${toolCodeMessage.tool_id || currentIndex}`}
                      toolCodeMessage={toolCodeMessage}
                      toolOutputMessage={toolOutputMessage}
                  />
              );
              
              if (toolOutputMessage) {
                  const toolOutputIndex = messages.indexOf(toolOutputMessage);
                  const nextAssistantMessage = messages[toolOutputIndex + 1];
                  // If another assistant message follows, continue the loop from there.
                  if (nextAssistantMessage && nextAssistantMessage.role === 'assistant') {
                      currentIndex = toolOutputIndex + 1;
                      lastMessageInTurnIndex = currentIndex;
                      continue;
                  }
              }
          }

          // If no tool call follows, this turn is over.
          lastMessageInTurnIndex = currentIndex;
          break;
      }

      const fullContent = textParts.join('\n\n');
      const isStreamingInThisTurn = isStreaming && (messages.length - 1 === lastMessageInTurnIndex);
      // --- END OF THE FIX ---

      return (
          <div className={`chat-message-wrapper assistant ${isStreamingInThisTurn ? 'is-streaming' : ''}`}>
              <div className="chat-message-container">
                  <div className="message-content-wrapper">
                      <div className={`message-content ${isStreamingInThisTurn ? 'is-streaming' : 'streaming-complete'}`}>
                          {turnParts}
                          
                          {isStreamingInThisTurn && <span className="streaming-cursor"></span>}

                          {turnParts.length === 0 && !isStreamingInThisTurn && '\u00A0'}
                      </div>
                      
                      {fullContent && !isStreamingInThisTurn && (
                          <div className="message-actions">
                              <Tooltip text="Regenerate">
                                  <button className="action-button" onClick={onRegenerate}>
                                      <FiRefreshCw size={16} />
                                  </button>
                              </Tooltip>
                              <Tooltip text="Copy">
                                  <button className="action-button" onClick={() => onCopy(fullContent)}>
                                      <FiCopy size={16} />
                                  </button>
                              </Tooltip>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );

  }

  return null;
};

export default memo(ChatMessage);