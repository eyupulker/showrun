import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { ResultStoreProvider } from '@showrun/core';
import type { DiscoveredPack } from './packDiscovery.js';
import { ConcurrencyLimiter } from './concurrency.js';
import { registerPackTools } from './toolRegistration.js';

/**
 * Options for MCP server
 */
export interface MCPServerOptions {
  /**
   * Discovered task packs
   */
  packs: DiscoveredPack[];
  /**
   * Base directory for run outputs
   */
  baseRunDir: string;
  /**
   * Maximum concurrent executions
   */
  concurrency: number;
  /**
   * Whether to run browser in headful mode
   */
  headful: boolean;
  /**
   * Per-pack result stores, keyed by tool name.
   * When provided, results are auto-stored after each successful run
   * and query/list tools are registered.
   */
  resultStores?: Map<string, ResultStoreProvider>;
}

/**
 * Creates and starts the MCP server
 */
export async function createMCPServer(
  options: MCPServerOptions
): Promise<void> {
  const { packs, baseRunDir, concurrency, headful, resultStores } = options;

  // Generate unique session ID for this server instance
  const serverSessionId = randomUUID();

  // Ensure base run directory exists
  mkdirSync(baseRunDir, { recursive: true });

  // Create concurrency limiter
  const limiter = new ConcurrencyLimiter(concurrency);

  // Log server startup
  console.error(`[MCP Server] Starting with ${packs.length} task pack(s)`);
  console.error(`[MCP Server] Session ID: ${serverSessionId}`);
  console.error(`[MCP Server] Concurrency: ${concurrency}, Headful: ${headful}`);
  console.error(`[MCP Server] Base run directory: ${baseRunDir}`);
  if (resultStores) {
    console.error(`[MCP Server] Result stores enabled for ${resultStores.size} pack(s)`);
  }

  // Create MCP server using the recommended high-level API
  const server = new McpServer({
    name: 'taskpack-mcp-server',
    version: '0.1.0',
  });

  // Register all pack tools + result tools via shared module
  registerPackTools(server, {
    packs,
    baseRunDir,
    limiter,
    headful,
    sessionId: serverSessionId,
    resultStores,
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP Server] Server started and ready');
}
