// src/components/ChatMessage.tsx

import { useState, useEffect, useRef } from 'react';
import type { Message, Attachment } from '../types';
import api from '../utils/api';
import '../css/ChatMessage.css';
import { FiCopy, FiRefreshCw, FiEdit } from 'react-icons/fi';
import ImageViewer from './ImageViewer';
import Tooltip from './Tooltip'; // <-- ADDED

const AnimatedStreamingText = ({ content, isStreaming }: { content: string; isStreaming: boolean }) => {
  // ... (no changes in this sub-component)
  const [previousContent, setPreviousContent] = useState('');
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (isStreaming && content.length > previousContent.length) {
      setPreviousContent(content);
      setAnimationKey(prev => prev + 1);
    } else if (!isStreaming) {
      setPreviousContent(content);
    }
  }, [content, isStreaming, previousContent.length]);

  if (!isStreaming || !content) {
    return <span>{content}</span>;
  }

  const stableContent = previousContent;
  const newContent = content.slice(previousContent.length);

  return (
    <span>
      <span>{stableContent}</span>
      {newContent && (
        <span key={animationKey} className="streaming-chunk">
          {newContent}
        </span>
      )}
    </span>
  );
};

// --- Helper component to securely load images ---
const AuthenticatedImage = ({ chatId, attachment, onView }: { chatId: string, attachment: Attachment, onView: (src: string) => void }) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    // --- FIX: The endpoint is now nullable if attachment._id doesn't exist ---
    const apiEndpoint = attachment._id ? `/files/view/${chatId}/${attachment._id}` : null;

    useEffect(() => {
        // If there's no ID, we can't fetch. The component will show a loading state.
        // When the parent component re-renders with an attachment that has an _id,
        // apiEndpoint will change, and this effect will re-run.
        if (!apiEndpoint) {
            setObjectUrl(null);
            setHasError(false);
            return;
        }

        let isMounted = true;
        let tempUrl: string | null = null;
        
        // Reset state for new fetch attempt
        setHasError(false);
        setObjectUrl(null);

        const fetchImage = async () => {
            try {
                const response = await api(apiEndpoint);
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}`);
                }
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
    // If we don't have an objectUrl (because we are fetching, or because we can't fetch yet), show loading.
    if (!objectUrl) return <div className="attachment-image-wrapper loading" />;

    return (
        <a href={objectUrl} onClick={handleViewClick} className="attachment-image-wrapper">
            <img src={objectUrl} alt={attachment.fileName} />
        </a>
    );
};


interface ChatMessageProps {
  message: Message;
  chatId: string | null;
  index: number;
  isEditing: boolean;
  isStreaming: boolean;
  onRegenerate: () => void;
  onCopy: () => void;
  onStartEdit: (index: number) => void;
  onSaveEdit: (index: number, newContent: string) => void;
  onCancelEdit: () => void;
}

const ChatMessage = ({ message, chatId, index, isEditing, isStreaming, onRegenerate, onCopy, onStartEdit, onSaveEdit, onCancelEdit }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const [editedContent, setEditedContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageContentRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [initialDimensions, setInitialDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // --- NEW: State for the ImageViewer ---
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [viewerAlt, setViewerAlt] = useState('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setEditedContent(message.content);
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
  
  // --- NEW: Handler to open the viewer ---
  const handleOpenViewer = (src: string, alt: string) => {
    setViewerSrc(src);
    setViewerAlt(alt);
    setIsViewerOpen(true);
  };

  const renderAttachments = (attachments: Attachment[]) => (
    <div className="message-attachments">
      {attachments.map(att => {
        if (!chatId) return null;
        
        // --- FIX: Use a stable key that exists even on optimistic updates ---
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
                // We need an _id to download, so if it's missing, we can't proceed.
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

  if (isUser) {
    return (
      <> {/* <-- NEW: Use Fragment to wrap message and viewer */}
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
                  {message.content && <div>{message.content}</div>}
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
        
        {/* --- NEW: Render the ImageViewer here --- */}
        <ImageViewer 
          isOpen={isViewerOpen}
          src={viewerSrc}
          alt={viewerAlt}
          onClose={() => setIsViewerOpen(false)}
        />
      </>
    );
  }

  // Assistant Message
  return (
    <div className={`chat-message-wrapper assistant`}>
      <div className="chat-message-container">
        <div className="message-content-wrapper">
          <div className="message-content">
            <AnimatedStreamingText content={message.content} isStreaming={isStreaming} />
            {isStreaming && <span className="streaming-cursor"></span>}
            {!message.content && !isStreaming && '\u00A0'}
          </div>
          {message.content && !isStreaming && (
            <div className="message-actions">
              <Tooltip text="Regenerate">
                <button className="action-button" onClick={onRegenerate}>
                  <FiRefreshCw size={16} />
                </button>
              </Tooltip>
              <Tooltip text="Copy">
                <button className="action-button" onClick={onCopy}>
                  <FiCopy size={16} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;