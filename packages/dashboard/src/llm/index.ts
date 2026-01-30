/**
 * LLM Provider Factory
 * Creates the appropriate LLM provider based on environment configuration
 */

import type { LlmProvider } from './provider.js';
import { OpenAIProvider } from './openai.js';

export function createLlmProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER || 'openai';

  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

export type { LlmProvider, ChatMessage } from './provider.js';
