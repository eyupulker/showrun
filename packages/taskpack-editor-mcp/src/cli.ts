#!/usr/bin/env node

import { createTaskPackEditorServer } from './server.js';

async function main() {
  const packDirs = (process.env.PACK_DIRS || './taskpacks').split(',');
  const workspaceDir = process.env.WORKSPACE_DIR || process.env.PACK_DIRS?.split(',')[0] || './taskpacks';
  const baseRunDir = process.env.BASE_RUN_DIR || './runs';

  await createTaskPackEditorServer({
    packDirs,
    workspaceDir,
    baseRunDir,
  });
}

main().catch((error) => {
  console.error(`[TaskPack Editor MCP] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
