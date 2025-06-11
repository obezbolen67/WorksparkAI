// src/types/index.ts

export type Attachment = {
  _id: string; 
  fileName: string;
  gcsObjectName: string;
  mimeType: string;
  size: number;
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
};

export type Message = {
  /**
   * 'user': A message from the user.
   * 'assistant': A text-based response from the AI.
   * 'tool_code': A special message from the AI containing one or more `tool_calls` to be executed.
   * 'tool': The output/result from a tool execution.
   */
  role: 'user' | 'assistant' | 'tool' | 'tool_code';
  content: string | null;
  attachments?: Attachment[];
  
  // `tool_calls` will ONLY appear on messages with `role: 'tool_code'`.
  tool_calls?: ToolCall[]; 
  
  // `tool_call_id` will ONLY appear on messages with `role: 'tool'`.
  tool_call_id?: string;
  
  // Client-side state for rendering the UI of a `tool_code` block.
  state?: 'processing' | 'executing' | 'completed' | 'error';

  // Client-side only field to hold the live, unescaped code during streaming.
  _streaming_code_content?: string;
};