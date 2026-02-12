/**
 * E2E test: MCP tool created from a flow returns _resultKey in the response,
 * and that stored results can be retrieved via showrun_query_results.
 *
 * Uses InMemoryTransport to connect a real MCP Client <-> Server in-process.
 * runTaskPack is mocked so no browser is needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { generateResultKey } from '@showrun/core';
import type { ResultStoreProvider } from '@showrun/core';
import { InMemoryResultStore } from '@showrun/harness';
import { discoverPacks } from '../packDiscovery.js';
import { registerPackTools } from '../toolRegistration.js';
import { ConcurrencyLimiter } from '../concurrency.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRunTaskPack = vi.fn();

vi.mock('@showrun/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@showrun/core')>();
  return {
    ...actual,
    runTaskPack: (...args: unknown[]) => mockRunTaskPack(...args),
  };
});

vi.mock('@showrun/harness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@showrun/harness')>();
  return {
    ...actual,
    JSONLLogger: vi.fn().mockImplementation(() => ({
      log: vi.fn(),
    })),
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP tool result store e2e', () => {
  let testDir: string;
  let packDir: string;
  let runsDir: string;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;
  const PACK_ID = 'test-e2e-result';

  beforeEach(async () => {
    testDir = join(tmpdir(), `showrun-e2e-${randomBytes(8).toString('hex')}`);
    packDir = join(testDir, 'taskpacks', PACK_ID);
    runsDir = join(testDir, 'runs');

    mkdirSync(packDir, { recursive: true });
    mkdirSync(runsDir, { recursive: true });

    // Write minimal taskpack.json + flow.json
    writeFileSync(
      join(packDir, 'taskpack.json'),
      JSON.stringify({
        id: PACK_ID,
        name: 'Test E2E Result',
        version: '1.0.0',
        kind: 'json-dsl',
      }),
    );
    writeFileSync(
      join(packDir, 'flow.json'),
      JSON.stringify({
        inputs: {},
        collectibles: [
          { name: 'items', type: 'string', description: 'Collected items' },
        ],
        flow: [{ type: 'navigate', url: 'https://example.com' }],
      }),
    );

    mockRunTaskPack.mockReset();
    mockRunTaskPack.mockResolvedValue({
      collectibles: { items: [{ name: 'A', price: 10 }, { name: 'B', price: 20 }] },
      meta: { durationMs: 100, url: 'https://example.com' },
    });
  });

  afterEach(async () => {
    try {
      await clientTransport?.close();
    } catch { /* ignore */ }
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Helper: set up an MCP server+client pair with the test pack and an InMemoryResultStore.
   * Uses the shared registerPackTools() — same logic as production server.ts / httpServer.ts.
   */
  async function setupServerAndClient(): Promise<{ store: InMemoryResultStore; toolName: string }> {
    const discovered = await discoverPacks({ directories: [join(testDir, 'taskpacks')] });
    expect(discovered.length).toBe(1);
    const pack = discovered[0];

    const store = new InMemoryResultStore();
    const resultStores = new Map<string, ResultStoreProvider>();
    resultStores.set(pack.toolName, store);

    const server = new McpServer({ name: 'test-server', version: '0.0.1' });
    const limiter = new ConcurrencyLimiter(1);

    registerPackTools(server, {
      packs: [pack],
      baseRunDir: runsDir,
      limiter,
      headful: false,
      sessionId: 'test-session',
      resultStores,
    });

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    return { store, toolName: pack.toolName };
  }

  it('small result includes _resultKey, _stored, and _hint', async () => {
    const { toolName } = await setupServerAndClient();

    const result = await client.callTool({ name: toolName, arguments: {} });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);

    expect(parsed._resultKey).toBeDefined();
    expect(parsed._resultKey).toMatch(/^[a-f0-9]{16}$/);
    expect(parsed._stored).toBe(true);
    expect(parsed._hint).toContain('showrun_query_results');
    // Original collectibles are present
    expect(parsed.items).toEqual([{ name: 'A', price: 10 }, { name: 'B', price: 20 }]);
  });

  it('large result returns summary with _resultKey instead of full data', async () => {
    // Generate a large payload exceeding LARGE_RESULT_THRESHOLD (10k chars)
    const largeItems = Array.from({ length: 300 }, (_, i) => ({
      name: `Product ${i}`,
      price: i * 10,
      description: `Detailed description for product number ${i} that adds to the overall size`,
    }));

    mockRunTaskPack.mockResolvedValueOnce({
      collectibles: { items: largeItems },
      meta: { durationMs: 500, url: 'https://example.com' },
    });

    const { toolName } = await setupServerAndClient();

    const result = await client.callTool({ name: toolName, arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);

    expect(parsed._resultKey).toBeDefined();
    expect(parsed._resultKey).toMatch(/^[a-f0-9]{16}$/);
    expect(parsed._summary).toContain('showrun_query_results');
    expect(parsed._message).toContain('Large result auto-stored');
    expect(parsed._preview).toBeDefined();
    // Full items should NOT be present (summarized instead)
    expect(parsed.items).toBeUndefined();
  });

  it('showrun_query_results retrieves stored result by key', async () => {
    const { toolName } = await setupServerAndClient();

    // Call the pack tool first
    const toolResult = await client.callTool({ name: toolName, arguments: {} });
    const toolText = (toolResult.content as Array<{ type: string; text: string }>)[0].text;
    const toolParsed = JSON.parse(toolText);
    const resultKey = toolParsed._resultKey;

    expect(resultKey).toBeDefined();

    // Give the fire-and-forget store a tick
    await new Promise((r) => setTimeout(r, 50));

    // Now query the stored result
    const queryResult = await client.callTool({
      name: 'showrun_query_results',
      arguments: { pack_tool_name: toolName, key: resultKey },
    });
    const queryText = (queryResult.content as Array<{ type: string; text: string }>)[0].text;
    const queryParsed = JSON.parse(queryText);

    expect(queryParsed.key).toBe(resultKey);
    expect(queryParsed.packId).toBe(PACK_ID);
    expect(queryParsed.collectibles).toEqual({
      items: [{ name: 'A', price: 10 }, { name: 'B', price: 20 }],
    });
    expect(queryParsed.meta).toBeDefined();
    expect(queryParsed.meta.url).toBe('https://example.com');
  });

  it('showrun_query_results with jmes_path filters stored data', async () => {
    const { toolName } = await setupServerAndClient();

    // Call pack tool to store result
    const toolResult = await client.callTool({ name: toolName, arguments: {} });
    const toolParsed = JSON.parse(
      (toolResult.content as Array<{ type: string; text: string }>)[0].text,
    );
    const resultKey = toolParsed._resultKey;

    await new Promise((r) => setTimeout(r, 50));

    // Query with JMESPath — extract names of items where price > 10
    const queryResult = await client.callTool({
      name: 'showrun_query_results',
      arguments: {
        pack_tool_name: toolName,
        key: resultKey,
        jmes_path: 'items[?price > `10`].name',
      },
    });
    const queryText = (queryResult.content as Array<{ type: string; text: string }>)[0].text;
    const queryParsed = JSON.parse(queryText);

    expect(queryParsed.key).toBe(resultKey);
    expect(queryParsed.data).toEqual(['B']);
  });

  it('showrun_list_results lists stored results', async () => {
    const { toolName } = await setupServerAndClient();

    // Call pack tool twice with different inputs to create two entries
    await client.callTool({ name: toolName, arguments: {} });
    await new Promise((r) => setTimeout(r, 50));

    const listResult = await client.callTool({
      name: 'showrun_list_results',
      arguments: {},
    });
    const listText = (listResult.content as Array<{ type: string; text: string }>)[0].text;
    const listParsed = JSON.parse(listText);

    expect(listParsed.total).toBeGreaterThanOrEqual(1);
    expect(listParsed.results.length).toBeGreaterThanOrEqual(1);
    expect(listParsed.results[0].packId).toBe(PACK_ID);
    expect(listParsed.results[0].key).toMatch(/^[a-f0-9]{16}$/);
  });

  it('result key is deterministic for same pack + inputs', async () => {
    const { toolName } = await setupServerAndClient();

    // Call the tool twice with the same inputs
    const result1 = await client.callTool({ name: toolName, arguments: {} });
    const parsed1 = JSON.parse(
      (result1.content as Array<{ type: string; text: string }>)[0].text,
    );

    const result2 = await client.callTool({ name: toolName, arguments: {} });
    const parsed2 = JSON.parse(
      (result2.content as Array<{ type: string; text: string }>)[0].text,
    );

    expect(parsed1._resultKey).toBe(parsed2._resultKey);

    // Matches the expected key from generateResultKey
    const expectedKey = generateResultKey(PACK_ID, {});
    expect(parsed1._resultKey).toBe(expectedKey);
  });
});
