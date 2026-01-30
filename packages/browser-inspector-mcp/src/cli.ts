#!/usr/bin/env node

import { createBrowserInspectorServer } from './server.js';

async function main() {
  await createBrowserInspectorServer({});
}

main().catch((error) => {
  console.error(`[Browser Inspector MCP] Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
