/**
 * Templating for DSL steps using Nunjucks renderString only.
 * Supports {{inputs.key}} / {{vars.key}} and built-in filters (e.g. {{inputs.x | urlencode}}).
 * Uses a minimal Environment with no loaders and no custom filters for safety.
 */

import nunjucks from 'nunjucks';
import type { VariableContext } from './types.js';

/** Minimal env: null loader (renderString only), no custom filters, only built-ins. throwOnUndefined to match previous behavior. */
const env = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: true,
});

/**
 * Resolves a template string using variable context (Nunjucks renderString).
 * Built-in filters available, e.g. {{ inputs.page | urlencode }}.
 */
export function resolveTemplate(template: string, context: VariableContext): string {
  try {
    return env.renderString(template, {
      inputs: context.inputs,
      vars: context.vars,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Template resolution failed: ${msg}`);
  }
}

/**
 * Recursively resolves templates in an object (strings use Nunjucks renderString).
 */
export function resolveTemplates<T>(obj: T, context: VariableContext): T {
  if (typeof obj === 'string') {
    return resolveTemplate(obj, context) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveTemplates(item, context)) as T;
  }

  if (obj && typeof obj === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveTemplates(value, context);
    }
    return resolved as T;
  }

  return obj;
}

/**
 * Checks if a string contains template syntax ({{ ... }}).
 */
export function hasTemplate(str: string): boolean {
  return typeof str === 'string' && str.includes('{{');
}
