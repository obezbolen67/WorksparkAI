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

const CodeBlock = ({ node, inline, className, children, style, ...props }: CodeComponentProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const theme = useTheme();
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
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

    if (inline) {
        return (
            <code className={className} style={style} {...props}>
                {children}
            </code>
        );
    }
    
    const { ref, ...syntaxHighlighterProps } = props;
    
    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="language-name">{language}</span>
                <button onClick={handleCopy} className="copy-code-button">
                    {isCopied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                    <span>{isCopied ? 'Copied!' : 'Copy code'}</span>
                </button>
            </div>
            <SyntaxHighlighter
                style={syntaxHighlighterStyle}
                language={language}
                PreTag="div"
                {...syntaxHighlighterProps}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    );
};

// --- START OF THE FIX ---
// This custom component fixes a hydration error caused by react-markdown.
// By default, it wraps elements like code blocks (`<pre>`) in a `<p>` tag.
// Our `CodeBlock` component renders a `<div>`, which is invalid inside a `<p>`.
// This component checks if a paragraph's only child is a code block,
// and if so, it renders the code block directly without the wrapping `<p>`.
const Paragraph: Components['p'] = ({ node, ...props }) => {
    const child = node?.children[0];
    if (
        node?.children.length === 1 &&
        child?.type === 'element' &&
        child?.tagName === 'pre'
    ) {
        return <>{props.children}</>;
    }
    return <p {...props} />;
};
// --- END OF THE FIX ---

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
  const isUser = message.role === 'user';
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

  if (message.role === 'tool_code') {
      // Find the corresponding tool output message in the full message history
      const toolOutput = messages.find(m => 
          m.role === 'tool' && 
          m.tool_call_id === message.tool_calls?.[0]?.id
      );
      
      return (
          <div className="chat-message-wrapper assistant">
              <div className="chat-message-container">
                  <div className="message-content-wrapper">
                      <div className="message-content">
                          <CodeAnalysisBlock 
                              toolCodeMessage={message}
                              toolOutputMessage={toolOutput}
                              isStreaming={isStreaming}
                          />
                      </div>
                  </div>
              </div>
          </div>
      );
  }
  
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
                  {message.content && <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock, p: Paragraph }}>{message.content}</ReactMarkdown>}
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
      const isLastMessage = index === messages.length - 1;

      return (
          <div className={`chat-message-wrapper assistant`}>
              <div className="chat-message-container">
                  <div className="message-content-wrapper">
                      <div className="message-content">
                          {message.content ? (
                              <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{ code: CodeBlock, p: Paragraph }}
                              >
                                  {message.content}
                              </ReactMarkdown>
                          ) : (
                              // Render a non-breaking space for empty messages to maintain bubble height,
                              // but only if it's not the active streaming message.
                              !isStreaming && '\u00A0'
                          )}
                          {/* Show streaming cursor if this is the last message and we are streaming */}
                          {isStreaming && isLastMessage && <span className="streaming-cursor"></span>}
                      </div>
                      
                      {/* Show actions only if there is content and we are not streaming */}
                      {message.content && !isStreaming && (
                          <div className="message-actions">
                              <Tooltip text="Regenerate">
                                  <button className="action-button" onClick={onRegenerate}>
                                      <FiRefreshCw size={16} />
                                  </button>
                              </Tooltip>
                              <Tooltip text="Copy">
                                  <button className="action-button" onClick={() => onCopy(message.content || '')}>
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