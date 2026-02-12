import { describe, it, expect } from 'vitest';
import { generateResultKey, canonicalizeInputs } from '@showrun/core';

describe('canonicalizeInputs', () => {
  it('sorts keys alphabetically', () => {
    const a = canonicalizeInputs({ z: 1, a: 2 });
    const b = canonicalizeInputs({ a: 2, z: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"z":1}');
  });

  it('handles nested objects', () => {
    const result = canonicalizeInputs({ b: { z: 1, a: 2 }, a: 'x' });
    expect(result).toBe('{"a":"x","b":{"a":2,"z":1}}');
  });

  it('strips undefined values', () => {
    const result = canonicalizeInputs({ a: 1, b: undefined });
    expect(result).toBe('{"a":1}');
  });

  it('preserves arrays in order', () => {
    const result = canonicalizeInputs({ items: [3, 1, 2] });
    expect(result).toBe('{"items":[3,1,2]}');
  });
});

describe('generateResultKey', () => {
  it('produces a 16-char hex string', () => {
    const key = generateResultKey('my-pack', { url: 'https://example.com' });
    expect(key).toMatch(/^[a-f0-9]{16}$/);
  });

  it('is deterministic', () => {
    const a = generateResultKey('pack-a', { x: 1 });
    const b = generateResultKey('pack-a', { x: 1 });
    expect(a).toBe(b);
  });

  it('differs by packId', () => {
    const a = generateResultKey('pack-a', { x: 1 });
    const b = generateResultKey('pack-b', { x: 1 });
    expect(a).not.toBe(b);
  });

  it('differs by inputs', () => {
    const a = generateResultKey('pack-a', { x: 1 });
    const b = generateResultKey('pack-a', { x: 2 });
    expect(a).not.toBe(b);
  });

  it('is insensitive to key order', () => {
    const a = generateResultKey('pack-a', { a: 1, b: 2 });
    const b = generateResultKey('pack-a', { b: 2, a: 1 });
    expect(a).toBe(b);
  });
});
