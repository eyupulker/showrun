/**
 * Chat slash commands for the dashboard.
 * Commands are ephemeral (not saved to DB) and executed client-side.
 */

import type { Message } from './ChatView.js';

export interface CommandContext {
  conversation: { id: string; title: string; packId: string | null; status: string } | null;
  token: string;
  messages: Message[];
  addSystemMessage: (content: string) => void;
  setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
  onCreateConversation: (packId: string) => Promise<void>;
}

export interface ChatCommand {
  name: string;
  aliases?: string[];
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<string | null>;
}

/**
 * Parse input text as a slash command.
 * Returns { command, args } if text starts with `/`, else null.
 */
export function parseCommand(text: string): { command: string; args: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { command: trimmed.slice(1).toLowerCase(), args: '' };
  }
  return {
    command: trimmed.slice(1, spaceIdx).toLowerCase(),
    args: trimmed.slice(spaceIdx + 1).trim(),
  };
}

/**
 * Look up a command by name or alias.
 */
export function findCommand(name: string): ChatCommand | undefined {
  return COMMAND_REGISTRY.find((cmd) => cmd.name === name || cmd.aliases?.includes(name));
}

// --- Command implementations ---

const helpCommand: ChatCommand = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  execute: async () => {
    const lines = COMMAND_REGISTRY.map((cmd) => {
      const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map((a) => `/${a}`).join(', ')})` : '';
      return `**/${cmd.name}**${aliases} - ${cmd.description}`;
    });
    return `Available commands:\n\n${lines.join('\n')}`;
  },
};

const statusCommand: ChatCommand = {
  name: 'status',
  description: 'Show current conversation and pack info',
  execute: async (_args, ctx) => {
    if (!ctx.conversation) {
      return 'No conversation selected.';
    }
    const c = ctx.conversation;
    const lines = [
      `**Conversation:** ${c.title}`,
      `**ID:** \`${c.id}\``,
      `**Status:** ${c.status}`,
      `**Pack:** ${c.packId || '(none)'}`,
      `**Messages:** ${ctx.messages.length}`,
    ];
    return lines.join('\n');
  },
};

const clearCommand: ChatCommand = {
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear chat display (messages stay in DB)',
  execute: async (_args, ctx) => {
    ctx.setMessages([]);
    return null; // No follow-up message needed — the clear is the feedback
  },
};

const newCommand: ChatCommand = {
  name: 'new',
  description: 'Create a new conversation linked to the current pack',
  execute: async (_args, ctx) => {
    if (!ctx.conversation) {
      return 'No active conversation. Start one first.';
    }
    if (!ctx.conversation.packId) {
      return 'No pack linked to this conversation. Use /new only after a pack is created.';
    }
    await ctx.onCreateConversation(ctx.conversation.packId);
    return null; // UI switch handles feedback
  },
};

const summarizeCommand: ChatCommand = {
  name: 'summarize',
  aliases: ['sum'],
  description: 'Force context summarization',
  execute: async (_args, ctx) => {
    if (!ctx.conversation) {
      return 'No active conversation.';
    }
    if (ctx.messages.length < 5) {
      return 'Too few messages to summarize (need at least 5).';
    }
    try {
      const response = await fetch('/api/teach/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-showrun-token': ctx.token,
        },
        body: JSON.stringify({ conversationId: ctx.conversation.id }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        return `Summarization failed: ${err.error || response.status}`;
      }
      const result = await response.json();
      if (result.wasSummarized) {
        return `Context summarized: ${result.tokensBefore.toLocaleString()} -> ${result.tokensAfter.toLocaleString()} tokens`;
      }
      return `Context is already compact (${result.tokensBefore.toLocaleString()} tokens). No summarization needed.`;
    } catch (err) {
      return `Summarization failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/**
 * All registered commands.
 */
export const COMMAND_REGISTRY: ChatCommand[] = [
  helpCommand,
  statusCommand,
  clearCommand,
  newCommand,
  summarizeCommand,
];
