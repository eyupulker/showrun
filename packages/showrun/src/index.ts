/**
 * @showrun/showrun - Public API
 * Re-export utilities from @showrun/core for backwards compatibility
 */

export type { BrowserInspectorOptions } from '@showrun/browser-inspector-mcp';
export { createBrowserInspectorServer } from '@showrun/browser-inspector-mcp';
export {
  atomicWrite,
  ensureDir,
  readJsonFile,
  sanitizePackId,
  validatePathInAllowedDir,
  writeFlowJson,
  writeTaskPackManifest,
} from '@showrun/core';
export type { DashboardOptions } from '@showrun/dashboard';
export { startDashboard } from '@showrun/dashboard';
export type { RunPackOptions, RunPackResult } from '@showrun/harness';
// Export command interfaces for programmatic use
export { runPack } from '@showrun/harness';
export type { DiscoveredPack, MCPServerOptions } from '@showrun/mcp-server';
export {
  createMCPServer,
  createMCPServerOverHTTP,
  discoverPacks,
} from '@showrun/mcp-server';
export type { TaskPackEditorOptions } from '@showrun/taskpack-editor-mcp';
export { createTaskPackEditorServer } from '@showrun/taskpack-editor-mcp';
