/**
 * OpenAI LLM Provider Implementation
 * Uses OPENAI_API_KEY from environment (server-side only)
 * On 429 rate limit, waits for the time suggested by the API (or Retry-After) then retries.
 */

import type {
  LlmProvider,
  ToolDef,
  ToolCall,
  ChatWithToolsResult,
  ChatMessage,
  ContentPart,
} from './provider.js';

const RATE_LIMIT_MAX_RETRIES = 5;
const RATE_LIMIT_WAIT_CAP_SECONDS = 120;
const RATE_LIMIT_WAIT_MIN_SECONDS = 1;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse how long to wait from a 429 response (OpenAI cookbook: retry with backoff).
 * Uses error.message "Please try again in X.XXs" or Retry-After header.
 */
function parseRateLimitWaitSeconds(response: Response, bodyText: string): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const sec = parseInt(retryAfter, 10);
    if (!Number.isNaN(sec)) return Math.min(Math.max(sec, RATE_LIMIT_WAIT_MIN_SECONDS), RATE_LIMIT_WAIT_CAP_SECONDS);
  }
  try {
    const json = JSON.parse(bodyText) as { error?: { message?: string } };
    const message = json?.error?.message ?? '';
    const match = message.match(/try again in ([\d.]+)s/i);
    if (match) {
      const sec = parseFloat(match[1]);
      if (!Number.isNaN(sec) && sec > 0) {
        return Math.min(Math.max(Math.ceil(sec), RATE_LIMIT_WAIT_MIN_SECONDS), RATE_LIMIT_WAIT_CAP_SECONDS);
      }
    }
  } catch {
    // ignore
  }
  return 20; // default wait if we can't parse
}

async function fetchWithRateLimitRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = RATE_LIMIT_MAX_RETRIES
): Promise<Response> {
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    const bodyText = await response.text();
    if (response.ok) {
      return new Response(bodyText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    lastStatus = response.status;
    lastBody = bodyText;
    if (response.status === 429 && attempt < maxRetries - 1) {
      const waitSec = parseRateLimitWaitSeconds(response, bodyText);
      await sleep(waitSec * 1000);
      continue;
    }
    throw new Error(`OpenAI API error: ${response.status} ${bodyText}`);
  }
  throw new Error(`OpenAI API error: ${lastStatus} ${lastBody}`);
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

export class OpenAIProvider implements LlmProvider {
  name = 'openai';
  private apiKey: string;
  private baseUrl: string;

  countTokens(text: string): number {
    // Approximate: ~4 chars per token for GPT-4 class models
    return Math.ceil(text.length / 4);
  }

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  async generateJson<T>(args: {
    system: string;
    prompt: string;
    schema: object;
  }): Promise<T> {
    const { system, prompt, schema } = args;

    // Use OpenAI's structured outputs (response_format)
    const response = await fetchWithRateLimitRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            strict: true,
            schema: schema,
          },
        },
        temperature: 0.1, // Low temperature for deterministic output
      }),
    });

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON from OpenAI response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async chat(args: {
    systemPrompt?: string;
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  }): Promise<string> {
    const { systemPrompt, messages } = args;
    const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const m of messages) {
      apiMessages.push({ role: m.role, content: m.content });
    }

    const response = await fetchWithRateLimitRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06',
        messages: apiMessages,
        temperature: 0.4,
      }),
    });

    const data = (await response.json()) as OpenAIResponse;
    const content = data.choices[0]?.message?.content;
    return content ?? '';
  }

  async chatWithTools(args: {
    systemPrompt?: string;
    messages: Array<
      | { role: 'user' | 'assistant' | 'system'; content: string }
      | { role: 'tool'; content: string; tool_call_id: string }
    >;
    tools: ToolDef[];
  }): Promise<ChatWithToolsResult> {
    const { systemPrompt, messages, tools } = args;
    const apiMessages: Array<
      | { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[] }
      | { role: 'assistant'; content: string | null; tool_calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
      | { role: 'tool'; content: string; tool_call_id: string }
    > = [];
    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }
    for (const m of messages) {
      if (m.role === 'tool') {
        apiMessages.push({ role: 'tool', content: m.content, tool_call_id: m.tool_call_id });
      } else if ('tool_calls' in m && m.role === 'assistant' && Array.isArray((m as any).tool_calls)) {
        const am = m as { role: 'assistant'; content: string | null; tool_calls: ToolCall[] };
        apiMessages.push({
          role: 'assistant',
          content: am.content ?? '',
          tool_calls: am.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });
      } else if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
        const content = (m as ChatMessage).content;
        if (Array.isArray(content)) {
          apiMessages.push({ role: m.role, content: content as ContentPart[] });
        } else {
          apiMessages.push({ role: m.role, content });
        }
      }
    }

    // OpenAI requires tool function names to match ^[a-zA-Z0-9_-]+$ (no dots, spaces, etc.)
    const sanitizeToolName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const apiTools = tools.length
      ? tools.map((t) => ({
          type: t.type,
          function: {
            name: sanitizeToolName(t.function.name),
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }))
      : undefined;

    const response = await fetchWithRateLimitRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06',
        messages: apiMessages,
        tools: apiTools,
        temperature: 0.3,
      }),
    });

    const data = (await response.json()) as OpenAIResponse;
    const msg = data.choices[0]?.message;
    if (!msg) {
      return { content: null, toolCalls: [] };
    }
    const content = msg.content ?? null;
    const toolCalls: ToolCall[] = (msg.tool_calls || []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
    return { content, toolCalls };
  }
}
