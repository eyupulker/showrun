/**
 * LLM Provider Factory
 * Creates the appropriate LLM provider based on environment configuration
 */

import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import type { LlmProvider } from './provider.js';

export function createLlmProvider(): LlmProvider {
  // Auto-detect provider based on available API keys
  const provider =
    process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');

  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export type { ChatMessage, LlmProvider, StreamEvent } from './provider.js';
