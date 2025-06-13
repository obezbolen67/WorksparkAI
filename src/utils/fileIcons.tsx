/// <reference types="vite/client" />

// Even with the new JSX transform, explicit type annotations like `JSX.Element`
// require the `JSX` namespace to be in scope. We import it directly here.
import type { JSX } from 'react';
import {
  FiFile, FiFileText, FiImage, FiCode, FiArchive, FiMusic, FiFilm
} from 'react-icons/fi';
import {
  BsFileEarmarkPdf, BsFileEarmarkWord, BsFileEarmarkPpt, BsFileEarmarkSpreadsheet,
  BsMarkdown,
} from 'react-icons/bs';

/**
 * Returns a React Icon component based on the file's MIME type.
 * @param mimeType The MIME type of the file (e.g., 'application/pdf').
 * @returns A JSX.Element representing the file icon.
 */
export const getFileIcon = (mimeType: string): JSX.Element => {
  if (!mimeType) return <FiFile />;

  // Image Types
  if (mimeType.startsWith('image/')) return <FiImage />;

  // Video Types
  if (mimeType.startsWith('video/')) return <FiFilm />;

  // Audio Types
  if (mimeType.startsWith('audio/')) return <FiMusic />;

  // Application & Text Specific Types
  switch (mimeType) {
    // Documents
    case 'application/pdf':
      return <BsFileEarmarkPdf />;
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return <BsFileEarmarkWord />;
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return <BsFileEarmarkPpt />;
    
    // Spreadsheets
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'text/csv':
      return <BsFileEarmarkSpreadsheet />;

    // Archives
    case 'application/zip':
    case 'application/x-rar-compressed':
    case 'application/x-7z-compressed':
    case 'application/x-tar':
      return <FiArchive />;

    // Code & Markup
    case 'application/javascript':
    case 'text/javascript':
    case 'text/x-python':
    case 'application/x-python-code':
    case 'application/json':
    case 'text/html':
    case 'text/css':
      return <FiCode />;
    case 'text/markdown':
      return <BsMarkdown />;

    // Plain Text
    case 'text/plain':
      return <FiFileText />;

    // Fallback for any other specific type
    default:
      return <FiFile />;
  }
};