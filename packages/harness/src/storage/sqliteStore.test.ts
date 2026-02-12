import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SQLiteResultStore } from './sqliteStore.js';
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

describe('SQLiteResultStore', () => {
  let store: SQLiteResultStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'showrun-test-'));
    store = new SQLiteResultStore(join(tmpDir, 'results.db'));
  });

  afterEach(async () => {
    await store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('declares capabilities', () => {
    const caps = store.capabilities();
    expect(caps).toContain('get');
    expect(caps).toContain('store');
    expect(caps).toContain('list');
    expect(caps).toContain('delete');
    expect(caps).toContain('filter');
  });

  it('stores and retrieves a result', async () => {
    await store.store(makeResult());
    const got = await store.get('abc123');
    expect(got).not.toBeNull();
    expect(got!.packId).toBe('test-pack');
    expect(got!.collectibles).toEqual({
      items: [
        { name: 'A', price: 10 },
        { name: 'B', price: 5 },
        { name: 'C', price: 20 },
      ],
    });
  });

  it('returns null for missing key', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('increments version on overwrite', async () => {
    await store.store(makeResult());
    expect((await store.get('abc123'))!.version).toBe(1);
    await store.store(makeResult({ storedAt: '2026-01-02T00:00:00Z' }));
    expect((await store.get('abc123'))!.version).toBe(2);
  });

  it('lists with pagination', async () => {
    await store.store(makeResult({ key: 'k1', storedAt: '2026-01-01T00:00:00Z' }));
    await store.store(makeResult({ key: 'k2', storedAt: '2026-01-02T00:00:00Z' }));
    await store.store(makeResult({ key: 'k3', storedAt: '2026-01-03T00:00:00Z' }));

    const page1 = await store.list!({ limit: 2 });
    expect(page1.total).toBe(3);
    expect(page1.results.length).toBe(2);
    expect(page1.results[0].key).toBe('k3'); // desc by default

    const page2 = await store.list!({ limit: 2, offset: 2 });
    expect(page2.results.length).toBe(1);
    expect(page2.results[0].key).toBe('k1');
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
      sortDir: 'desc',
      limit: 2,
    });
    expect(total).toBe(3);
    expect(data).toEqual([
      { name: 'C', price: 20 },
      { name: 'A', price: 10 },
    ]);
  });

  it('persists across re-open', async () => {
    const dbPath = join(tmpDir, 'results.db');
    await store.store(makeResult());
    await store.close();

    const store2 = new SQLiteResultStore(dbPath);
    const got = await store2.get('abc123');
    expect(got).not.toBeNull();
    expect(got!.version).toBe(1);
    await store2.close();
  });
});
