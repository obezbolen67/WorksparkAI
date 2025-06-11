// src/types/index.ts

export type Attachment = {
  _id: string; 
  fileName: string;
  gcsObjectName: string;
  mimeType: string;
  size: number;
};

// This type is no longer needed with our new logic.
// export type ToolCall = { ... };

export type Message = {
  role: 'user' | 'assistant' | 'tool' | 'tool_code';
  content: string | null;
  attachments?: Attachment[];
  tool_id?: string;
  state?: 'writing' | 'ready_to_execute' | 'executing' | 'completed' | 'error';
};