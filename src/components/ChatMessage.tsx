import { useState, useEffect, useRef, memo, useMemo } from 'react';
import type { Message, Attachment } from '../types';
import api, { API_BASE_URL } from '../utils/api';
import '../css/ChatMessage.css';
import React from 'react';
import { FiCopy, FiRefreshCw, FiEdit, FiCheck } from 'react-icons/fi';
import ImageViewer from './ImageViewer';
import Tooltip from './Tooltip';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CodeAnalysisBlock from './CodeAnalysisBlock';
import InlineThinking from './InlineThinking';

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
    if (node?.children.length === 1 && child?.type === 'element' && (child?.tagName === 'pre' || childClassName.includes('code-analysis-container') || childClassName.includes('inline-thinking-container'))) {
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

interface ChatMessageProps {
  message: Message;
  messages: Message[];
  chatId: string | null;
  index: number;
  isEditing: boolean;
  isStreaming: boolean;
  isThinking: boolean;
  onRegenerate: () => void;
  onCopy: (content: string) => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onCancelEdit: () => void;
}

const ChatMessage = ({ message, messages, chatId, index, isEditing, isStreaming, isThinking, onRegenerate, onCopy, onStartEdit, onSaveEdit, onCancelEdit }: ChatMessageProps) => {
  const [editedContent, setEditedContent] = useState(message.content || '');
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const messageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) setEditedContent(message.content || '');
  }, [isEditing, message.content]);

  const handleOpenViewer = (src: string) => { setViewerSrc(src); setIsViewerOpen(true); };

  const renderAttachments = (attachments: Attachment[]) => (
    <div className="message-attachments">
      {attachments.map(att => {
        if (!chatId || !att._id) return null;
        const key = att._id || att.gcsObjectName;
        if (att.mimeType.startsWith('image/')) {
          return <AuthenticatedImage key={key} chatId={chatId} attachment={att} onView={handleOpenViewer} />;
        }
        return <a key={key} href={`${API_BASE_URL}/api/files/view/${chatId}/${att._id}`} target="_blank" rel="noopener noreferrer" download={att.fileName} className="attachment-file-link">{att.fileName}</a>;
      })}
    </div>
  );

  if (message.role === 'tool' || message.role === 'tool_code') {
    return null;
  }
  
  if (message.role === 'user') {
    return (
      <>
        <div className={`chat-message-wrapper user ${isEditing ? 'editing' : ''}`}>
          <div className="chat-message-container">
            <div className="user-message-bubble">
              {!isEditing ? (
                <div ref={messageContentRef} className="message-content">
                  {message.attachments && message.attachments.length > 0 && renderAttachments(message.attachments)}
                  {message.content && <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CustomCode, p: Paragraph }}>{message.content}</ReactMarkdown>}
                  {!message.content && !message.attachments?.length && '\u00A0'}
                </div>
              ) : (
                <div className="message-editor-content">
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(index, editedContent); } if (e.key === 'Escape') onCancelEdit(); }} rows={1} />
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
        <ImageViewer isOpen={isViewerOpen} src={viewerSrc} alt={viewerSrc || ''} onClose={() => setIsViewerOpen(false)} />
      </>
    );
  }

  if (message.role === 'assistant') {
    if (index > 0 && messages[index - 1]?.role !== 'user') {
      return null;
    }
    
    const { turnParts, fullContent, lastMessageInTurnIndex } = useMemo(() => {
        const parts: React.ReactNode[] = [];
        const textParts: string[] = [];
        let lastIndex = index;
        const processedToolIds = new Set<string>();

        for (let i = index; i < messages.length; i++) {
            const currentMessage = messages[i];

            if (currentMessage.role === 'user') {
                break;
            }

            if (currentMessage.role === 'assistant') {
                if (currentMessage.thinking) {
                    const isCurrentlyStreamingThinking = isStreaming && i === messages.length - 1;
                    parts.push(
                        <InlineThinking 
                            key={`thinking-${i}`} 
                            content={currentMessage.thinking}
                            isStreaming={isCurrentlyStreamingThinking}
                        />
                    );
                }
                if (currentMessage.content) {
                    textParts.push(currentMessage.content);
                    parts.push(
                        <ReactMarkdown key={`text-${i}`} remarkPlugins={[remarkGfm]} components={{ code: CustomCode, p: Paragraph }}>
                            {currentMessage.content}
                        </ReactMarkdown>
                    );
                }
            } else if (currentMessage.role === 'tool_code' && currentMessage.tool_id && !processedToolIds.has(currentMessage.tool_id)) {
                const toolOutputMessage = messages.find(m => m.role === 'tool' && m.tool_id === currentMessage.tool_id);
                parts.push(
                    <CodeAnalysisBlock 
                        key={`code-${currentMessage.tool_id}`} 
                        toolCodeMessage={currentMessage} 
                        toolOutputMessage={toolOutputMessage} 
                    />
                );
                processedToolIds.add(currentMessage.tool_id);
            }
            
            lastIndex = i;
        }
        
        return {
            turnParts: parts,
            fullContent: textParts.join('\n\n'),
            lastMessageInTurnIndex: lastIndex
        };
    }, [messages, index, isStreaming]);

    const showThinkingIndicator = isThinking && isStreaming && index === messages.length - 1 && !turnParts.some(part => 
        React.isValidElement(part) && part.key?.toString().startsWith('thinking')
    );

    if (showThinkingIndicator) {
        turnParts.unshift(
            <InlineThinking 
                key="thinking-active" 
                content=""
                isStreaming={true}
            />
        );
    }

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
  }

  return null;
};

export default memo(ChatMessage);