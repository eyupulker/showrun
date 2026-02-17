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

/** Stream events for chatWithToolsStream */
export type StreamEvent =
  | { type: 'thinking_start' }
  | { type: 'thinking_delta'; text: string }
  | { type: 'thinking_stop'; text: string }
  | { type: 'content_start' }
  | { type: 'content_delta'; text: string }
  | { type: 'content_stop'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_stop'; toolCall: ToolCall }
  | { type: 'message_stop' };

export interface LlmProvider {
  name: string;
  /** Count tokens in a text string. Used for context window management. */
  countTokens(text: string): number;
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

  /**
   * Chat with tools (streaming): yields stream events for thinking, content, and tool calls.
   * Returns final result when complete.
   * Optional - providers that don't support streaming can omit this.
   */
  chatWithToolsStream?(args: {
    systemPrompt?: string;
    messages: Array<
      | ChatMessage
      | { role: 'tool'; content: string; tool_call_id: string }
      | { role: 'assistant'; content: string | null; tool_calls: ToolCall[] }
    >;
    tools: ToolDef[];
    enableThinking?: boolean;
  }): AsyncGenerator<StreamEvent, ChatWithToolsResult, unknown>;
}
