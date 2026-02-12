import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryResultStore } from './inMemoryStore.js';
import type { StoredResult } from '@showrun/core';

function makeResult(overrides: Partial<StoredResult> = {}): StoredResult {
  return {
    key: 'abc123',
    packId: 'test-pack',
    toolName: 'test_pack',
    inputs: { url: 'https://example.com' },
    collectibles: {
      items: [
        { name: 'A', price: 10 },
        { name: 'B', price: 5 },
        { name: 'C', price: 20 },
      ],
    },
    meta: { durationMs: 1234 },
    collectibleSchema: [
      { name: 'items', type: 'string' },
    ],
    storedAt: '2026-01-01T00:00:00Z',
    ranAt: '2026-01-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

describe('InMemoryResultStore', () => {
  let store: InMemoryResultStore;

  beforeEach(() => {
    store = new InMemoryResultStore();
  });

  it('declares capabilities', () => {
    const caps = store.capabilities();
    expect(caps).toContain('get');
    expect(caps).toContain('store');
    expect(caps).toContain('list');
    expect(caps).toContain('filter');
  });

  it('stores and retrieves a result', async () => {
    const r = makeResult();
    await store.store(r);
    const got = await store.get('abc123');
    expect(got).not.toBeNull();
    expect(got!.packId).toBe('test-pack');
  });

  it('returns null for missing key', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('increments version on overwrite', async () => {
    await store.store(makeResult());
    expect((await store.get('abc123'))!.version).toBe(1);
    await store.store(makeResult());
    expect((await store.get('abc123'))!.version).toBe(2);
    await store.store(makeResult());
    expect((await store.get('abc123'))!.version).toBe(3);
  });

  it('lists stored results', async () => {
    await store.store(makeResult({ key: 'k1', storedAt: '2026-01-01T00:00:00Z' }));
    await store.store(makeResult({ key: 'k2', storedAt: '2026-01-02T00:00:00Z' }));

    const { results, total } = await store.list!();
    expect(total).toBe(2);
    expect(results.length).toBe(2);
    // Default sort: storedAt desc → k2 first
    expect(results[0].key).toBe('k2');
    expect(results[1].key).toBe('k1');
  });

  it('paginates list results', async () => {
    await store.store(makeResult({ key: 'k1', storedAt: '2026-01-01T00:00:00Z' }));
    await store.store(makeResult({ key: 'k2', storedAt: '2026-01-02T00:00:00Z' }));
    await store.store(makeResult({ key: 'k3', storedAt: '2026-01-03T00:00:00Z' }));

    const page1 = await store.list!({ limit: 2, offset: 0 });
    expect(page1.results.length).toBe(2);
    expect(page1.total).toBe(3);

    const page2 = await store.list!({ limit: 2, offset: 2 });
    expect(page2.results.length).toBe(1);
  });

  it('deletes a result', async () => {
    await store.store(makeResult());
    expect(await store.delete!('abc123')).toBe(true);
    expect(await store.get('abc123')).toBeNull();
    expect(await store.delete!('abc123')).toBe(false);
  });

  it('filters with JMESPath', async () => {
    await store.store(makeResult());
    const { data, total } = await store.filter!({
      key: 'abc123',
      jmesPath: 'items[].name',
    });
    expect(data).toEqual(['A', 'B', 'C']);
    expect(total).toBe(3);
  });

  it('filters with sort + pagination', async () => {
    await store.store(makeResult());
    const { data, total } = await store.filter!({
      key: 'abc123',
      jmesPath: 'items',
      sortBy: 'price',
      sortDir: 'asc',
      limit: 2,
      offset: 0,
    });
    expect(total).toBe(3);
    expect(data).toEqual([
      { name: 'B', price: 5 },
      { name: 'A', price: 10 },
    ]);
  });

  it('returns null for filter on missing key', async () => {
    const { data, total } = await store.filter!({
      key: 'missing',
    });
    expect(data).toBeNull();
    expect(total).toBe(0);
  });
});
