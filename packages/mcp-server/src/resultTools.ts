/**
 * MCP tools for querying and listing stored run results.
 *
 * Registered when result stores are provided to the server.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { ResultStoreProvider } from '@showrun/core';

/**
 * Register showrun_query_results and showrun_list_results tools
 * on the given MCP server instance.
 *
 * @param server  - McpServer to register tools on
 * @param stores  - Map of toolName → ResultStoreProvider
 */
export function registerResultTools(
  server: McpServer,
  stores: Map<string, ResultStoreProvider>,
): void {
  // ---------------------------------------------------------------------------
  // showrun_query_results
  // ---------------------------------------------------------------------------
  server.registerTool(
    'showrun_query_results',
    {
      title: 'Query stored results',
      description:
        'Query or filter stored task pack run results. ' +
        'Use `pack_tool_name` to target a specific pack\'s store. ' +
        'If `key` is omitted, returns the latest stored result for that pack. ' +
        'Use `jmes_path` to extract/transform data with JMESPath expressions (e.g. `items[?price > \\`10\\`].name`). ' +
        'Supports pagination via `limit` and `offset`.',
      inputSchema: {
        pack_tool_name: z.string().describe('Tool name of the pack whose results to query'),
        key: z.string().optional().describe('Result key (omit for latest)'),
        jmes_path: z.string().optional().describe('JMESPath expression to filter/extract data'),
        sort_by: z.string().optional().describe('Field to sort by within collectibles'),
        sort_dir: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: asc)'),
        limit: z.number().optional().describe('Max items to return (for arrays)'),
        offset: z.number().optional().describe('Pagination offset'),
      },
    },
    async (inputs: Record<string, unknown>) => {
      const packToolName = inputs.pack_tool_name as string;
      const store = stores.get(packToolName);

      if (!store) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `No result store found for pack tool "${packToolName}"` }) }],
          isError: true,
        };
      }

      // Resolve key: explicit or latest
      let key = inputs.key as string | undefined;
      if (!key) {
        if (!store.list) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Store does not support listing — provide an explicit key' }) }],
            isError: true,
          };
        }
        const { results } = await store.list({ limit: 1, sortBy: 'storedAt', sortDir: 'desc' });
        if (results.length === 0) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No stored results yet for this pack' }) }],
          };
        }
        key = results[0].key;
      }

      // If JMESPath / pagination requested, use filter()
      const jmesPath = inputs.jmes_path as string | undefined;
      const sortBy = inputs.sort_by as string | undefined;
      const sortDir = inputs.sort_dir as 'asc' | 'desc' | undefined;
      const limit = inputs.limit as number | undefined;
      const offset = inputs.offset as number | undefined;

      const hasFilter = jmesPath || sortBy || limit !== undefined || offset !== undefined;

      if (hasFilter && store.filter && store.capabilities().includes('filter')) {
        const { data, total } = await store.filter({
          key,
          jmesPath,
          sortBy,
          sortDir,
          limit,
          offset,
        });
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ key, total, data }, null, 2),
          }],
        };
      }

      // Plain get
      const result = await store.get(key);
      if (!result) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `No result found for key "${key}"` }) }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            key: result.key,
            packId: result.packId,
            version: result.version,
            storedAt: result.storedAt,
            ranAt: result.ranAt,
            meta: result.meta,
            collectibles: result.collectibles,
          }, null, 2),
        }],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // showrun_list_results
  // ---------------------------------------------------------------------------
  server.registerTool(
    'showrun_list_results',
    {
      title: 'List stored results',
      description:
        'List stored task pack run results across all packs (or filter by pack). ' +
        'Returns summaries with keys you can use with showrun_query_results.',
      inputSchema: {
        pack_tool_name: z.string().optional().describe('Filter to a specific pack tool name'),
        limit: z.number().optional().describe('Max results to return (default: 50)'),
        offset: z.number().optional().describe('Pagination offset (default: 0)'),
      },
    },
    async (inputs: Record<string, unknown>) => {
      const targetPack = inputs.pack_tool_name as string | undefined;
      const limit = (inputs.limit as number | undefined) ?? 50;
      const offset = (inputs.offset as number | undefined) ?? 0;

      const allSummaries: Array<{
        key: string;
        packId: string;
        toolName: string;
        storedAt: string;
        version: number;
        fieldCount: number;
      }> = [];

      const storeEntries = targetPack
        ? [[targetPack, stores.get(targetPack)] as const].filter(([, s]) => s != null)
        : Array.from(stores.entries());

      for (const [, store] of storeEntries) {
        if (!store || !store.list) continue;
        try {
          const { results } = await store.list({ limit: 200, sortBy: 'storedAt', sortDir: 'desc' });
          allSummaries.push(...results);
        } catch {
          // skip stores that error
        }
      }

      // Sort all by storedAt desc
      allSummaries.sort((a, b) => (a.storedAt > b.storedAt ? -1 : a.storedAt < b.storedAt ? 1 : 0));

      const total = allSummaries.length;
      const page = allSummaries.slice(offset, offset + limit);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ total, offset, limit, results: page }, null, 2),
        }],
      };
    },
  );
}
