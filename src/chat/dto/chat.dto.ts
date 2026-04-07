/**
 * Request body for the POST /api/chat endpoint.
 * Standard OpenAI chat completions format — passed through as-is to RedPill AI.
 * Message content is E2EE-encrypted by the client and never decrypted by this gateway.
 */
export interface ChatRequestBody {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  model?: string;
  tool_choice?: 'auto' | 'none' | 'required';
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}
