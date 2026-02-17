/**
 * Tests that runPack() auto-stores results and returns _resultKey,
 * and that large results preserve _resultKey after truncation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

import { TaskPackEditorWrapper, type RunPackResult } from '../mcpWrappers.js';
import { executeAgentTool, type AgentToolContext } from '../agentTools.js';
import { InMemoryResultStore } from '@showrun/harness';
import { generateResultKey } from '@showrun/core';
import type { ResultStoreProvider } from '@showrun/core';

// Mock runTaskPack — default returns small result; tests can override via mockResolvedValueOnce
const mockRunTaskPack = vi.fn().mockResolvedValue({
  collectibles: { items: [{ name: 'A', price: 10 }] },
  meta: { durationMs: 100, url: 'https://example.com' },
});

vi.mock('@showrun/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@showrun/core')>();
  return {
    ...actual,
    runTaskPack: (...args: unknown[]) => mockRunTaskPack(...args),
  };
});

// Mock JSONLLogger to avoid filesystem side-effects
vi.mock('@showrun/harness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@showrun/harness')>();
  return {
    ...actual,
    JSONLLogger: vi.fn().mockImplementation(() => ({
      log: vi.fn(),
    })),
  };
});

// Mock database module (needed by executeAgentTool)
vi.mock('../db.js', () => ({
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
  initDatabase: vi.fn(),
  getDatabase: vi.fn(),
}));

// Mock browserInspector (needed by executeAgentTool)
vi.mock('../browserInspector.js', () => ({
  startBrowserSession: vi.fn().mockResolvedValue('mock-session'),
  gotoUrl: vi.fn().mockResolvedValue({ url: 'https://example.com', title: 'Example' }),
  closeSession: vi.fn(),
  getSession: vi.fn().mockReturnValue(null),
  isSessionAlive: vi.fn().mockReturnValue(false),
}));

// Mock contextManager
vi.mock('../contextManager.js', () => ({
  executePlanTool: vi.fn().mockReturnValue('{}'),
}));

describe('runPack result store integration', () => {
  let testDir: string;
  let packDir: string;
  let runsDir: string;
  const PACK_ID = 'test-result-store';

  beforeEach(() => {
    testDir = join(tmpdir(), `showrun-test-${randomBytes(8).toString('hex')}`);
    packDir = join(testDir, 'taskpacks', PACK_ID);
    runsDir = join(testDir, 'runs');

    mkdirSync(packDir, { recursive: true });
    mkdirSync(runsDir, { recursive: true });

    // Write minimal taskpack.json + flow.json
    writeFileSync(join(packDir, 'taskpack.json'), JSON.stringify({
      id: PACK_ID,
      name: 'Test Result Store',
      version: '1.0.0',
      kind: 'json-dsl',
    }));
    writeFileSync(join(packDir, 'flow.json'), JSON.stringify({
      inputs: {},
      collectibles: [{ name: 'items', type: 'string' }],
      flow: [{ type: 'navigate', url: 'https://example.com' }],
    }));

    mockRunTaskPack.mockReset();
    mockRunTaskPack.mockResolvedValue({
      collectibles: { items: [{ name: 'A', price: 10 }] },
      meta: { durationMs: 100, url: 'https://example.com' },
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns _resultKey when resultStores is provided', async () => {
    const store = new InMemoryResultStore();
    const stores = new Map<string, ResultStoreProvider>();
    stores.set(PACK_ID, store);

    const wrapper = new TaskPackEditorWrapper(
      [join(testDir, 'taskpacks')],
      join(testDir, 'taskpacks'),
      runsDir,
      false,
      stores,
    );

    const result = await wrapper.runPack(PACK_ID, {});

    expect(result.success).toBe(true);
    expect(result._resultKey).toBeDefined();
    expect(result._resultKey).toMatch(/^[a-f0-9]{16}$/);

    // Verify the expected key matches
    const expectedKey = generateResultKey(PACK_ID, {});
    expect(result._resultKey).toBe(expectedKey);
  });

  it('stores result in the store', async () => {
    const store = new InMemoryResultStore();
    const stores = new Map<string, ResultStoreProvider>();
    stores.set(PACK_ID, store);

    const wrapper = new TaskPackEditorWrapper(
      [join(testDir, 'taskpacks')],
      join(testDir, 'taskpacks'),
      runsDir,
      false,
      stores,
    );

    const result = await wrapper.runPack(PACK_ID, {});

    // Give the fire-and-forget store.store() a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    const stored = await store.get(result._resultKey!);
    expect(stored).not.toBeNull();
    expect(stored!.packId).toBe(PACK_ID);
    expect(stored!.collectibles).toEqual({ items: [{ name: 'A', price: 10 }] });
  });

  it('does NOT return _resultKey when no store is provided', async () => {
    const wrapper = new TaskPackEditorWrapper(
      [join(testDir, 'taskpacks')],
      join(testDir, 'taskpacks'),
      runsDir,
      false,
    );

    const result = await wrapper.runPack(PACK_ID, {});

    expect(result.success).toBe(true);
    expect(result._resultKey).toBeUndefined();
  });
});

describe('editor_run_pack tool preserves _resultKey for large results', () => {
  let testDir: string;
  let packDir: string;
  let runsDir: string;
  const PACK_ID = 'test-result-store';

  beforeEach(() => {
    testDir = join(tmpdir(), `showrun-test-${randomBytes(8).toString('hex')}`);
    packDir = join(testDir, 'taskpacks', PACK_ID);
    runsDir = join(testDir, 'runs');

    mkdirSync(packDir, { recursive: true });
    mkdirSync(runsDir, { recursive: true });

    writeFileSync(join(packDir, 'taskpack.json'), JSON.stringify({
      id: PACK_ID,
      name: 'Test Result Store',
      version: '1.0.0',
      kind: 'json-dsl',
    }));
    writeFileSync(join(packDir, 'flow.json'), JSON.stringify({
      inputs: {},
      collectibles: [{ name: 'items', type: 'string' }],
      flow: [{ type: 'navigate', url: 'https://example.com' }],
    }));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('includes _resultKey in tool output even when result is large', async () => {
    // Generate a large collectibles payload (>8000 chars when serialized)
    const largeItems = Array.from({ length: 200 }, (_, i) => ({
      name: `Product ${i}`,
      price: i * 10,
      description: `This is a long description for product ${i} that adds to the overall size of the output`,
    }));

    mockRunTaskPack.mockResolvedValueOnce({
      collectibles: { items: largeItems },
      meta: { durationMs: 500, url: 'https://example.com' },
    });

    const store = new InMemoryResultStore();
    const stores = new Map<string, ResultStoreProvider>();
    stores.set(PACK_ID, store);

    const wrapper = new TaskPackEditorWrapper(
      [join(testDir, 'taskpacks')],
      join(testDir, 'taskpacks'),
      runsDir,
      false,
      stores,
    );

    const ctx: AgentToolContext = {
      taskPackEditor: wrapper,
      packId: PACK_ID,
      sessionKey: 'test-session',
      conversationId: 'test-conv',
      headful: false,
      packMap: new Map(),
    };

    const execResult = await executeAgentTool('editor_run_pack', {}, ctx);
    const parsed = JSON.parse(execResult.stringForLlm);

    // The key MUST be present in the output the LLM sees
    expect(parsed._resultKey).toBeDefined();
    expect(parsed._resultKey).toMatch(/^[a-f0-9]{16}$/);
    expect(parsed._stored).toBe(true);
    expect(parsed._hint).toContain('showrun_query_results');
    expect(parsed.success).toBe(true);
  });

  it('returns full result when output is small', async () => {
    const store = new InMemoryResultStore();
    const stores = new Map<string, ResultStoreProvider>();
    stores.set(PACK_ID, store);

    const wrapper = new TaskPackEditorWrapper(
      [join(testDir, 'taskpacks')],
      join(testDir, 'taskpacks'),
      runsDir,
      false,
      stores,
    );

    const ctx: AgentToolContext = {
      taskPackEditor: wrapper,
      packId: PACK_ID,
      sessionKey: 'test-session',
      conversationId: 'test-conv',
      headful: false,
      packMap: new Map(),
    };

    const execResult = await executeAgentTool('editor_run_pack', {}, ctx);
    const parsed = JSON.parse(execResult.stringForLlm);

    // Small result: full collectibles + _resultKey
    expect(parsed.success).toBe(true);
    expect(parsed._resultKey).toBeDefined();
    expect(parsed.collectibles).toBeDefined();
    expect(parsed.collectibles.items).toEqual([{ name: 'A', price: 10 }]);
  });
});
