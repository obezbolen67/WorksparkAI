// src/types/index.ts

export type Attachment = {
  _id: string; // From MongoDB
  fileName: string;
  gcsObjectName: string;
  mimeType: string;
  size: number;
};

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[]; // Attachments are optional
};