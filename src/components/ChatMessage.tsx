import { useState, useEffect, memo, useMemo, useRef, useCallback } from 'react';
import type { Message, Attachment } from '../types';
import api, { API_BASE_URL } from '../utils/api';
import '../css/ChatMessage.css';
import React from 'react';
import { FiCopy, FiRefreshCw, FiEdit, FiCheck, FiLoader } from 'react-icons/fi';
import ImageViewer from './ImageViewer';
import Tooltip from './Tooltip';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CodeAnalysisBlock from './CodeAnalysisBlock';
import InlineThinking from './InlineThinking';
import { getFileIcon } from '../utils/fileIcons';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import SearchBlock from './SearchBlock';
import AnalysisBlock from './AnalysisBlock';
import '../css/AnalysisBlock.css';
import { useNotification } from '../contexts/NotificationContext';
import GeolocationBlock from './GeolocationBlock';
import GeolocationRequestBlock from './GeolocationRequestBlock';


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
                    setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
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
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (err) { console.warn("Clipboard API failed, falling back.", err); }
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed"; textArea.style.top = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus(); textArea.select();
  try { return document.execCommand("copy"); }
  catch (err) { console.error("Fallback failed.", err); return false; }
  finally { document.body.removeChild(textArea); }
}

const CustomCode = ({ node, inline, className, children, style, ...props }: CodeComponentProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const theme = useTheme();
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  const syntaxHighlighterStyle = theme === 'light' ? oneLight : vscDarkPlus;

  const handleCopy = async () => {
    if (await copyTextToClipboard(codeString)) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } else { alert("Failed to copy."); }
  };

  return !inline && match ? (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="language-name">{match[1]}</span>
        <button onClick={handleCopy} className="copy-code-button">
          {isCopied ? <FiCheck size={16} /> : <FiCopy size={16} />}
          <span>{isCopied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <SyntaxHighlighter style={syntaxHighlighterStyle} language={match[1]} PreTag="div" {...props}>{codeString}</SyntaxHighlighter>
    </div>
  ) : <code className={className} {...props}>{children}</code>;
};

const Paragraph: Components['p'] = ({ node, ...props }) => {
    const child = node?.children[0];
    const childClassName = (child?.type === 'element' && child.properties?.className?.toString()) || '';
    if (node?.children.length === 1 && child?.type === 'element' && (child?.tagName === 'pre' || childClassName.includes('tool-block-container') || childClassName.includes('inline-thinking-container') || childClassName.includes('markdown-image-wrapper') || childClassName.includes('geolocation-request-container'))) {
        return <>{props.children}</>;
    }
    return <p {...props} />;
};

const AuthenticatedImage = ({ chatId, attachment, onView }: { chatId: string, attachment: Attachment, onView: (src: string) => void }) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);
    const apiEndpoint = attachment._id ? `/files/view/${chatId}/${attachment._id}` : null;

    useEffect(() => {
        if (!apiEndpoint) { setObjectUrl(null); setHasError(false); return; }
        let isMounted = true, tempUrl: string | null = null;
        setHasError(false); setObjectUrl(null);
        api(apiEndpoint)
            .then(res => { if (!res.ok) throw new Error(`Server responded with ${res.status}`); return res.blob(); })
            .then(blob => { if (isMounted) { tempUrl = URL.createObjectURL(blob); setObjectUrl(tempUrl); }})
            .catch(error => { console.error(`Failed to load authenticated image for ${attachment.fileName}:`, error); if (isMounted) setHasError(true); });
        return () => { isMounted = false; if (tempUrl) URL.revokeObjectURL(tempUrl); };
    }, [apiEndpoint, attachment.fileName]);

    if (hasError) return <div className="attachment-image-wrapper error"><span>Error Loading Image</span></div>;
    if (!objectUrl) return <div className="attachment-image-wrapper loading" />;

    return (
        <a href={objectUrl} onClick={(e) => { e.preventDefault(); onView(objectUrl); }} className="attachment-image-wrapper">
            <img src={objectUrl} alt={attachment.fileName} />
        </a>
    );
};

type AssistantTurnProps = Omit<ChatMessageProps, 'message' | 'index' | 'isEditing' | 'onStartEdit' | 'onSaveEdit' | 'onCancelEdit'> & { 
  startIndex: number;
  onView: (src: string) => void; 
};

const AssistantTurn = memo(({ messages, chatId, startIndex, isStreaming, onRegenerate, onCopy, onView }: AssistantTurnProps) => {
    const firstMessageOfTurn = messages[startIndex];
    if (firstMessageOfTurn?.isWaiting) {
        return (
            <div className="chat-message-wrapper assistant">
                <div className="chat-message-container">
                    <div className="message-content-wrapper">
                        <div className="waiting-indicator">
                            <div className="dot"></div>
                            <div className="dot"></div>
                            <div className="dot"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const ImageRenderer: Components['img'] = ({ src, alt }) => {
        if (!src) return null;
        return (
            <a href={src} onClick={(e) => { e.preventDefault(); onView(src); }} className="markdown-image-wrapper">
                <img src={src} alt={alt || 'image from message'} />
            </a>
        );
    };

    const { turnParts, fullContent, lastMessageInTurnIndex } = useMemo(() => {
        const parts: React.ReactNode[] = [];
        const textParts: string[] = [];
        let lastIndex = startIndex;
        const processedToolIds = new Set<string>();
        let currentTextBuffer = '';

        const processMarkdownContent = (content: string, isCurrentlyStreaming: boolean = false) => {
            if (!isCurrentlyStreaming) return content;
            
            const lines = content.split('\n');
            const lastLineIndex = lines.length - 1;

            if (lastLineIndex >= 0) {
                const lastLineTrimmed = lines[lastLineIndex].trim();
                if (lastLineTrimmed === '---' || lastLineTrimmed === '===') {
                    lines[lastLineIndex] = lines[lastLineIndex] + '\u200B';
                }
            }
            
            return lines.join('\n');
        };

        // --- START OF THE FIX ---
        // Removed the unused 'forceMarkdown' parameter
        const flushTextBuffer = (key: string) => {
        // --- END OF THE FIX ---
            if (currentTextBuffer.trim()) {
                const processedContent = processMarkdownContent(currentTextBuffer, isStreaming);

                parts.push(
                    <ReactMarkdown
                        key={key}
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{ code: CustomCode, p: Paragraph, img: ImageRenderer }}
                    >
                        {processedContent}
                    </ReactMarkdown>
                );
            }
            currentTextBuffer = '';
        };

        for (let i = startIndex; i < messages.length; i++) {
            const currentMessage = messages[i];

            if (currentMessage.role === 'user') {
                lastIndex = i - 1;
                break;
            }

            if (currentMessage.role === 'assistant') {
                if (currentMessage.thinking !== undefined) {
                    flushTextBuffer(`text-before-thinking-${i}`);
                    const isCurrentlyStreamingThinking = isStreaming && i === messages.length - 1;
                    parts.push(<InlineThinking key={`thinking-${i}`} content={currentMessage.thinking || ''} isStreaming={isCurrentlyStreamingThinking} />);
                }
                if (currentMessage.content) {
                    textParts.push(currentMessage.content);
                    currentTextBuffer += currentMessage.content;
                }
            } else if (currentMessage.role === 'tool_code' && currentMessage.tool_id && !processedToolIds.has(currentMessage.tool_id)) {
                flushTextBuffer(`text-before-tool-code-${i}`);
                const toolOutputMessage = messages.find(m => m.role === 'tool_code_result' && m.tool_id === currentMessage.tool_id);
                parts.push(<CodeAnalysisBlock key={`code-${currentMessage.tool_id}`} chatId={chatId} toolCodeMessage={currentMessage} toolOutputMessage={toolOutputMessage} onView={onView} />);
                processedToolIds.add(currentMessage.tool_id);
            } else if (currentMessage.role === 'tool_search' && currentMessage.tool_id && !processedToolIds.has(currentMessage.tool_id)) {
                flushTextBuffer(`text-before-tool-search-${i}`);
                const toolOutputMessage = messages.find(m => m.role === 'tool_search_result' && m.tool_id === currentMessage.tool_id);
                const isGeolocationMap = toolOutputMessage?.content?.includes('[LOCATION]');
                if (isGeolocationMap) {
                    parts.push(<GeolocationBlock key={`geo-${currentMessage.tool_id}`} toolMessage={currentMessage} outputMessage={toolOutputMessage} />);
                } else {
                    parts.push(<SearchBlock key={`search-${currentMessage.tool_id}`} toolSearchMessage={currentMessage} toolOutputMessage={toolOutputMessage} />);
                }
                processedToolIds.add(currentMessage.tool_id);
            } else if (currentMessage.role === 'tool_doc_extract' && currentMessage.tool_id && !processedToolIds.has(currentMessage.tool_id)) {
                flushTextBuffer(`text-before-tool-extract-${i}`);
                const toolOutputMessage = messages.find(m => m.role === 'tool_doc_extract_result' && m.tool_id === currentMessage.tool_id);
                parts.push(<AnalysisBlock key={`extract-${currentMessage.tool_id}`} toolMessage={currentMessage} outputMessage={toolOutputMessage} />);
                processedToolIds.add(currentMessage.tool_id);
            } else if (currentMessage.role === 'tool_geolocation' && currentMessage.tool_id && !processedToolIds.has(currentMessage.tool_id)) {
                flushTextBuffer(`text-before-tool-geo-request-${i}`);
                const hasResult = messages.some(m => m.role === 'tool_geolocation_result' && m.tool_id === currentMessage.tool_id);
                if (!hasResult) {
                    parts.push(<GeolocationRequestBlock key={`geo-req-${currentMessage.tool_id}`} toolMessage={currentMessage} />);
                }
                processedToolIds.add(currentMessage.tool_id);
            }

            lastIndex = i;
        }

        flushTextBuffer('text-final');

        return { turnParts: parts, fullContent: textParts.join('\n\n'), lastMessageInTurnIndex: lastIndex };
    }, [messages, chatId, startIndex, isStreaming, onView]);


    const isStreamingInThisTurn = isStreaming && (messages.length - 1 <= lastMessageInTurnIndex);

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
                            <Tooltip text="Regenerate"><button className="action-button" onClick={onRegenerate}><FiRefreshCw size={16} /></button></Tooltip>
                            <Tooltip text="Copy"><button className="action-button" onClick={() => onCopy(fullContent)}><FiCopy size={16} /></button></Tooltip>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

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
  onSaveEdit: (index: number, newContent: string, metadata?: Record<string, any>) => void;
  onCancelEdit: () => void;
}

const ChatMessage = ({ message, messages, chatId, index, isEditing, onStartEdit, onSaveEdit, onCancelEdit, ...rest }: ChatMessageProps) => {
  const { showNotification } = useNotification();
  const [editedContent, setEditedContent] = useState(message.content || '');
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadAttachment = async (e: React.MouseEvent<HTMLAnchorElement>, attachment: Attachment) => {
    e.preventDefault();
    if (downloadingId) return; // Prevent multiple concurrent downloads

    if (!chatId || !attachment._id) {
      showNotification('Cannot download file: Missing identifiers.', 'error');
      return;
    }

    setDownloadingId(attachment._id); // Set downloading state for this attachment

    try {
      const response = await api(`/files/view/${chatId}/${attachment._id}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: 'Download failed' }));
        throw new Error(errorData.msg || `Server responded with ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.fileName);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download error:', error);
      showNotification(error instanceof Error ? error.message : 'Could not download file.', 'error');
    } finally {
      setDownloadingId(null); // Reset downloading state
    }
  };

  useEffect(() => {
    if (isEditing) {
      setEditedContent(message.content || '');
    }
  }, [isEditing, message.content]);

  useEffect(() => {
    if (isEditing && editTextAreaRef.current) {
      const textarea = editTextAreaRef.current;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      
      setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }, 0);
    }
  }, [isEditing]);

  const handleOpenViewer = useCallback((src: string) => { setViewerSrc(src); setIsViewerOpen(true); }, []);

  const handleEditContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const ImageRenderer: Components['img'] = ({ src, alt }) => {
    if (!src) return null;
    return (
        <a href={src} onClick={(e) => { e.preventDefault(); handleOpenViewer(src); }} className="markdown-image-wrapper">
            <img src={src} alt={alt || 'image from message'} />
        </a>
    );
  };

  const renderAttachments = (attachments: Attachment[]) => (
    <div className="message-attachments">
      {attachments.map(att => {
        if (!chatId || !att._id) return null;
        const key = att._id || att.gcsObjectName;
        const isImage = att.mimeType.startsWith('image/');
        
        if (isImage) {
          return <AuthenticatedImage key={key} chatId={chatId} attachment={att} onView={handleOpenViewer} />;
        }
        
        const isDownloading = downloadingId === att._id;
        return (
          <a 
            key={key} 
            href={`${API_BASE_URL}/api/files/view/${chatId}/${att._id}`}
            onClick={(e) => handleDownloadAttachment(e, att)}
            className={`attachment-file-link ${isDownloading ? 'downloading' : ''}`}
            aria-label={isDownloading ? `Downloading ${att.fileName}` : `Download ${att.fileName}`}
          >
            <span className="attachment-file-icon">
              {isDownloading ? <FiLoader className="spinner-icon" /> : getFileIcon(att.mimeType)}
            </span>
            <span className="attachment-file-name">
              {isDownloading ? 'Downloading...' : att.fileName}
            </span>
          </a>
        );
      })}
    </div>
  );

  const renderMessageContent = () => {
    if (message.role === 'user') {
      return (
        <div className={`chat-message-wrapper user ${isEditing ? 'editing' : ''}`}>
          <div className="chat-message-container">
            <div className="user-message-bubble">
              {!isEditing ? (
                <div className="message-content">
                  {message.attachments && message.attachments.length > 0 && renderAttachments(message.attachments)}
                  {message.content && <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{ code: CustomCode, p: Paragraph, img: ImageRenderer }}>{message.content}</ReactMarkdown>}
                  {!message.content && !message.attachments?.length && '\u00A0'}
                </div>
              ) : (
                <div className="message-editor-content">
                    <textarea 
                      ref={editTextAreaRef}
                      value={editedContent} 
                      onChange={handleEditContentChange} 
                      onKeyDown={handleEditKeyDown}
                      rows={1} 
                    />
                    <div className="editor-actions">
                        <button className="editor-button cancel" onClick={onCancelEdit}>Cancel</button>
                        <button className="editor-button save" onClick={() => onSaveEdit(index, editedContent)}>Save & Submit</button>
                    </div>
                </div>
              )}
            </div>
            {!isEditing && message.content && (
              <div className="message-actions">
                <Tooltip text="Edit"><button className="action-button" onClick={() => onStartEdit(index)}><FiEdit size={16} /></button></Tooltip>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    const isStartOfTurn = index === 0 || messages[index - 1]?.role === 'user';
    if (isStartOfTurn) {
      return <AssistantTurn chatId={chatId} messages={messages} startIndex={index} {...rest} onView={handleOpenViewer} />;
    }
    
    return null;
  };

  return (
    <>
      {renderMessageContent()}
      <ImageViewer isOpen={isViewerOpen} src={viewerSrc} alt={viewerSrc || ''} onClose={() => setIsViewerOpen(false)} />
    </>
  );
};

export default memo(ChatMessage);