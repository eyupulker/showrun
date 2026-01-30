/**
 * LLM Provider Abstraction
 * Provider-agnostic interface for structured JSON generation and chat
 */

/** Content part for multimodal messages (text or image) */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

/** OpenAI-style tool definition for function calling */
export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  };
}

/** Tool call requested by the model */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Result of chatWithTools: either content or tool calls to execute */
export interface ChatWithToolsResult {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  name: string;
  generateJson<T>(args: {
    system: string;
    prompt: string;
    schema: object; // JSON schema for the expected output
  }): Promise<T>;
  /**
   * Chat completion: send messages and get assistant reply (free-form text).
   */
  chat(args: {
    systemPrompt?: string;
    messages: ChatMessage[];
  }): Promise<string>;
  /**
   * Chat with tools: model may return tool_calls; execute them and call again until final reply.
   * messages may include assistant messages with tool_calls (for multi-turn tool use).
   */
  chatWithTools(args: {
    systemPrompt?: string;
    messages: Array<
      | ChatMessage
      | { role: 'tool'; content: string; tool_call_id: string }
      | { role: 'assistant'; content: string | null; tool_calls: ToolCall[] }
    >;
    tools: ToolDef[];
  }): Promise<ChatWithToolsResult>;
}
