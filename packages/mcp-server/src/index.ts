/**
 * @showrun/mcp-server - Public API
 * MCP server for Task Pack framework
 */

// Pack discovery
export { discoverPacks, packIdToToolName } from './packDiscovery.js';
export type { DiscoveredPack, PackDiscoveryOptions } from './packDiscovery.js';

// Concurrency
export { ConcurrencyLimiter } from './concurrency.js';

// Shared tool registration
export { registerPackTools, inputSchemaToZodSchema, buildToolDescription, packToSchema, LARGE_RESULT_THRESHOLD } from './toolRegistration.js';
export type { RegisterPackToolsOptions, MCPRunStartInfo, MCPRunCompleteInfo } from './toolRegistration.js';

// Stdio server
export { createMCPServer } from './server.js';
export type { MCPServerOptions } from './server.js';

// HTTP server
export { createMCPServerOverHTTP } from './httpServer.js';
export type {
  MCPServerHTTPOptions,
  MCPServerHTTPHandle,
} from './httpServer.js';

// Result tools
export { registerResultTools } from './resultTools.js';
