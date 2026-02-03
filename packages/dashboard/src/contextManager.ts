/**
 * Context Manager for Agent Conversations
 * Handles token estimation, message summarization, and plan storage
 */

import type { LlmProvider } from './llm/provider.js';

// Token estimation: ~4 characters per token (rough approximation for Claude)
const CHARS_PER_TOKEN = 4;

// Thresholds
const TOKEN_LIMIT_SOFT = 100_000;  // Start summarizing at this point
const TOKEN_LIMIT_HARD = 180_000;  // Absolute max before forced truncation
const RECENT_MESSAGES_TO_KEEP = 10; // Keep last N messages unsummarized

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// Use a generic type to avoid conflicts with local type definitions
export type AgentMessage =
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; name: string; arguments: string }> }
  | { role: 'tool'; content: string; tool_call_id: string };

// Internal alias for backward compat within this file
type AgentMsg = AgentMessage;

/**
 * Estimate token count for a message
 */
function estimateMessageTokens(msg: AgentMsg): number {
  let chars = 0;

  if (typeof msg.content === 'string') {
    chars += msg.content?.length || 0;
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        chars += part.text.length;
      } else if (part.type === 'image_url') {
        // Images are roughly 1000-2000 tokens depending on size
        // Base64 encoded images are large, estimate conservatively
        const url = part.image_url.url;
        if (url.startsWith('data:')) {
          // Estimate based on base64 length (roughly 1 token per 100 base64 chars for images)
          chars += Math.min(url.length / 25, 8000); // Cap at ~2000 tokens per image
        } else {
          chars += 1000 * CHARS_PER_TOKEN; // URL reference, estimate 1000 tokens
        }
      }
    }
  }

  // Add overhead for role, tool_calls structure, etc.
  if ('tool_calls' in msg && msg.tool_calls) {
    chars += JSON.stringify(msg.tool_calls).length;
  }
  if ('tool_call_id' in msg) {
    chars += 50; // Overhead for tool response structure
  }

  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Estimate total tokens for system prompt + messages
 */
export function estimateTotalTokens<T extends { role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string }>(
  systemPrompt: string,
  messages: T[]
): number {
  let total = Math.ceil(systemPrompt.length / CHARS_PER_TOKEN);
  for (const msg of messages) {
    total += estimateMessageTokens(msg as unknown as AgentMsg);
  }
  return total;
}

/**
 * Session plan storage (in-memory, keyed by packId or sessionId)
 */
const planStorage = new Map<string, string>();

/**
 * Save a plan for a session
 */
export function savePlan(sessionKey: string, plan: string): void {
  planStorage.set(sessionKey, plan);
  console.log(`[ContextManager] Plan saved for ${sessionKey} (${plan.length} chars)`);
}

/**
 * Get a plan for a session
 */
export function getPlan(sessionKey: string): string | null {
  return planStorage.get(sessionKey) || null;
}

/**
 * Clear a plan for a session
 */
export function clearPlan(sessionKey: string): void {
  planStorage.delete(sessionKey);
}

/**
 * Summarize older messages to reduce context size
 * Returns a new message array with older messages summarized
 *
 * @template T - The message type (must have role, content properties)
 */
export async function summarizeIfNeeded<T extends AgentMessage>(
  systemPrompt: string,
  messages: T[],
  llmProvider: LlmProvider,
  sessionKey?: string
): Promise<{ messages: T[]; wasSummarized: boolean; tokensBefore: number; tokensAfter: number }> {
  const tokensBefore = estimateTotalTokens(systemPrompt, messages);

  // Check if we need to summarize
  if (tokensBefore < TOKEN_LIMIT_SOFT) {
    return { messages, wasSummarized: false, tokensBefore, tokensAfter: tokensBefore };
  }

  console.log(`[ContextManager] Token count ${tokensBefore} exceeds soft limit ${TOKEN_LIMIT_SOFT}, summarizing...`);

  // Split messages: keep recent, summarize older
  const recentCount = Math.min(RECENT_MESSAGES_TO_KEEP, messages.length);
  const olderMessages = messages.slice(0, -recentCount);
  const recentMessages = messages.slice(-recentCount);

  if (olderMessages.length === 0) {
    // Nothing to summarize, all messages are "recent"
    console.log(`[ContextManager] All messages are recent, cannot summarize further`);
    return { messages, wasSummarized: false, tokensBefore, tokensAfter: tokensBefore };
  }

  // Get existing plan if any
  const existingPlan = sessionKey ? getPlan(sessionKey) : null;

  // Build summary prompt
  const olderContent = olderMessages.map((m, i) => {
    const role = m.role.toUpperCase();
    let content = '';
    if (typeof m.content === 'string') {
      content = m.content || '(empty)';
    } else if (Array.isArray(m.content)) {
      content = m.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('\n') || '(media content)';
    }
    if ('tool_calls' in m && m.tool_calls) {
      const toolNames = (m.tool_calls as Array<{ name: string }>).map(tc => tc.name).join(', ');
      content += `\n[Called tools: ${toolNames}]`;
    }
    if ('tool_call_id' in m) {
      content = `[Tool result for ${m.tool_call_id}]: ${content.slice(0, 500)}${content.length > 500 ? '...' : ''}`;
    }
    // Truncate very long messages in the summary input
    if (content.length > 2000) {
      content = content.slice(0, 2000) + '... (truncated)';
    }
    return `[${i + 1}] ${role}: ${content}`;
  }).join('\n\n');

  const summarySystemPrompt = `You are a conversation summarizer. Create a concise summary of the conversation that preserves:
1. The user's original goal/request
2. Key decisions made
3. Important findings or results
4. Current state/progress
5. Any errors encountered and how they were resolved

${existingPlan ? `\nEXISTING PLAN (keep this intact):\n${existingPlan}\n` : ''}

Keep the summary under 2000 words. Focus on information needed to continue the conversation.`;

  const summaryPrompt = `Summarize this conversation history:\n\n${olderContent}`;

  try {
    const summary = await llmProvider.chat({
      systemPrompt: summarySystemPrompt,
      messages: [{ role: 'user', content: summaryPrompt }],
    });

    // Create summarized message array
    // Cast to T since summary message has compatible structure with user messages
    const summaryMessage = {
      role: 'user' as const,
      content: `[CONVERSATION SUMMARY - Earlier messages have been summarized to save context]\n\n${summary}\n\n[END SUMMARY - Recent messages follow]`,
    } as T;

    const newMessages: T[] = [summaryMessage, ...recentMessages];
    const tokensAfter = estimateTotalTokens(systemPrompt, newMessages);

    console.log(`[ContextManager] Summarized ${olderMessages.length} messages. Tokens: ${tokensBefore} -> ${tokensAfter}`);

    // If still over hard limit, we need to be more aggressive
    if (tokensAfter > TOKEN_LIMIT_HARD) {
      console.log(`[ContextManager] Still over hard limit, truncating recent messages`);
      // Keep only the summary and last 3 messages
      const truncatedMessages: T[] = [summaryMessage, ...recentMessages.slice(-3)];
      const tokensFinal = estimateTotalTokens(systemPrompt, truncatedMessages);
      return { messages: truncatedMessages, wasSummarized: true, tokensBefore, tokensAfter: tokensFinal };
    }

    return { messages: newMessages, wasSummarized: true, tokensBefore, tokensAfter };
  } catch (error) {
    console.error(`[ContextManager] Summarization failed:`, error);
    // Fallback: just truncate older messages
    const fallbackMessages = messages.slice(-RECENT_MESSAGES_TO_KEEP);
    const tokensAfter = estimateTotalTokens(systemPrompt, fallbackMessages);
    return { messages: fallbackMessages, wasSummarized: true, tokensBefore, tokensAfter };
  }
}

/**
 * MCP Tool definition for saving plans
 */
export const PLAN_TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'agent_save_plan',
    description: 'Save the current plan/strategy for this task. Use this to persist important context that should survive conversation summarization. Call this whenever you formulate a multi-step plan.',
    parameters: {
      type: 'object' as const,
      properties: {
        plan: {
          type: 'string',
          description: 'The plan text to save. Should include: goal, steps, current progress, and any important decisions.',
        },
      },
      required: ['plan'],
    },
  },
};

/**
 * MCP Tool definition for getting plans
 */
export const GET_PLAN_TOOL_DEFINITION = {
  type: 'function' as const,
  function: {
    name: 'agent_get_plan',
    description: 'Retrieve the saved plan for this task. Use this at the start of a conversation or after summarization to recover context.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
};

/**
 * Execute plan tools
 */
export function executePlanTool(
  toolName: string,
  args: Record<string, unknown>,
  sessionKey: string
): string {
  if (toolName === 'agent_save_plan') {
    const plan = args.plan as string;
    if (!plan) {
      return JSON.stringify({ error: 'plan parameter is required' });
    }
    savePlan(sessionKey, plan);
    return JSON.stringify({ success: true, message: 'Plan saved successfully' });
  }

  if (toolName === 'agent_get_plan') {
    const plan = getPlan(sessionKey);
    if (plan) {
      return JSON.stringify({ success: true, plan });
    }
    return JSON.stringify({ success: true, plan: null, message: 'No plan saved yet' });
  }

  return JSON.stringify({ error: `Unknown plan tool: ${toolName}` });
}
