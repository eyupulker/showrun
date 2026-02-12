/**
 * Deterministic key generation for stored results.
 *
 * key = sha256(packId + ":" + canonicalized_inputs)[0..16]  (16-char hex)
 */
import { createHash } from 'crypto';

/**
 * Produce a canonical, stable JSON representation of inputs.
 * - Sorts object keys recursively
 * - Strips `undefined` values
 */
export function canonicalizeInputs(inputs: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(inputs));
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      const val = (obj as Record<string, unknown>)[key];
      if (val !== undefined) {
        sorted[key] = sortKeys(val);
      }
    }
    return sorted;
  }
  return obj;
}

/**
 * Generate a deterministic result key from pack ID and inputs.
 * Same packId + same inputs ⇒ same key (latest-wins cache).
 */
export function generateResultKey(
  packId: string,
  inputs: Record<string, unknown>,
): string {
  const payload = packId + ':' + canonicalizeInputs(inputs);
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}
