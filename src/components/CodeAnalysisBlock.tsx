// src/components/CodeAnalysisBlock.tsx
import { useState, useMemo, memo } from 'react';
import { FiChevronDown, FiDownload, FiFileText, FiCheck, FiCopy, FiImage } from 'react-icons/fi';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message, FileOutput } from '../types';
import '../css/CodeAnalysisBlock.css';
import { useNotification } from '../contexts/NotificationContext';
import { useSettings } from '../contexts/SettingsContext';

interface CodeAnalysisBlockProps {
  chatId: string | null;
  toolCodeMessage: Message;
  toolOutputMessage?: Message;
  onView: (src: string) => void;
}

const CodeAnalysisBlock = ({ toolCodeMessage, toolOutputMessage, onView }: CodeAnalysisBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { showNotification } = useNotification();
  const { theme } = useSettings();

  const state = toolCodeMessage.state || 'writing';
  const code = toolCodeMessage.content || '';
  const hasError = state === 'error';
  const output = toolOutputMessage?.content || '';
  const fileOutputs = toolOutputMessage?.fileOutputs || [];

  const isPending = state === 'writing' || state === 'executing';

  const syntaxTheme = theme === 'light' ? oneLight : vscDarkPlus;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = async (e: React.MouseEvent, fileOutput: FileOutput) => {
    e.stopPropagation(); // Prevent accordion toggle
    try {
      const link = document.createElement('a');
      link.href = fileOutput.url;
      link.setAttribute('download', fileOutput.fileName);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      window.open(fileOutput.url, '_blank');
      showNotification('Could not download file', 'error');
    }
  };

  const handlePreviewClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation(); // Prevent accordion toggle
    onView(url);
  };

  const label = useMemo(() => {
    if (isPending) return 'Analyzing...';
    if (state === 'error') return 'Analysis Failed';
    return 'Analyzed';
  }, [state, isPending]);

  return (
    <div className={`code-analysis-container ${state} ${isExpanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="analysis-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="analysis-header-content">
          <div className="analysis-header-left">
            <span className={`analysis-label ${isPending ? 'animate-shine' : ''}`}>{label}</span>
          </div>
          <FiChevronDown className="chevron-icon" />
        </div>

        {/* --- NEW: File Preview Strip (Visible when collapsed) --- */}
        {!isExpanded && fileOutputs.length > 0 && (
          <div className="analysis-file-preview">
            {fileOutputs.map((f, i) => (
              f.mimeType.startsWith('image/') ? (
                <div 
                  key={i} 
                  className="preview-item image" 
                  onClick={(e) => handlePreviewClick(e, f.url)}
                  title={f.fileName}
                >
                  <img src={f.url} alt={f.fileName} />
                </div>
              ) : (
                <div 
                  key={i} 
                  className="preview-item file" 
                  onClick={(e) => handleDownload(e, f)}
                  title={`Download ${f.fileName}`}
                >
                  <div className="file-icon-wrapper">
                    <FiFileText size={14} />
                  </div>
                  <span className="preview-filename">{f.fileName}</span>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="analysis-content">
          <div className="code-block-header">
            <span className="lang-label">python</span>
            <button className="copy-btn" onClick={handleCopy}>
              {isCopied ? <><FiCheck size={12} /> Copied</> : <><FiCopy size={12} /> Copy code</>}
            </button>
          </div>
          
          <div className="code-wrapper">
            <SyntaxHighlighter
              style={syntaxTheme}
              language="python"
              PreTag="div"
              wrapLines={true}
              wrapLongLines={true}
              customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.9rem' }}
            >
              {code}
            </SyntaxHighlighter>
          </div>

          {(output || fileOutputs.length > 0) && (
            <div className="console-output">
              <div className="console-header">Output</div>
              {output && <pre className={`console-text ${hasError ? 'error' : ''}`}>{output}</pre>}
              
              {/* Full File List in Expanded View */}
              {fileOutputs.length > 0 && (
                <div className="console-files">
                  {fileOutputs.map((f, i) => (
                    f.mimeType.startsWith('image/') ? (
                      <div key={i} className="console-image" onClick={() => onView(f.url)}>
                        <img src={f.url} alt={f.fileName} />
                      </div>
                    ) : (
                      <div key={i} className="console-file">
                        <FiFileText /> <span>{f.fileName}</span>
                        <button onClick={(e) => handleDownload(e, f)}><FiDownload /></button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(CodeAnalysisBlock);