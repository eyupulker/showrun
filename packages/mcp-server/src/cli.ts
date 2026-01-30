#!/usr/bin/env node

import { resolve } from 'path';
import { discoverPacks } from './packDiscovery.js';
import { createMCPServer } from './server.js';

interface CliOptions {
  packs: string[];
  headful: boolean;
  concurrency: number;
  baseRunDir: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let packsStr: string | null = null;
  // Default to headful if DISPLAY is available, otherwise headless
  let headful = !!process.env.DISPLAY;
  let concurrency = 1;
  let baseRunDir = './runs';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--packs' && i + 1 < args.length) {
      packsStr = args[i + 1];
      i++;
    } else if (args[i] === '--headful') {
      headful = true;
    } else if (args[i] === '--headless') {
      headful = false;
    } else if (args[i] === '--concurrency' && i + 1 < args.length) {
      concurrency = parseInt(args[i + 1], 10);
      if (isNaN(concurrency) || concurrency < 1) {
        console.error('Error: --concurrency must be a positive integer');
        process.exit(1);
      }
    } else if (args[i] === '--baseRunDir' && i + 1 < args.length) {
      baseRunDir = args[i + 1];
    }
  }

  if (!packsStr) {
    console.error('Error: --packs <dir1,dir2,...> is required');
    console.error('Example: tp mcp --packs ./taskpacks,./other-packs');
    process.exit(1);
  }

  const packs = packsStr.split(',').map((dir) => dir.trim()).filter(Boolean);

  if (packs.length === 0) {
    console.error('Error: At least one pack directory is required');
    process.exit(1);
  }

  return {
    packs: packs.map((dir) => resolve(dir)),
    headful,
    concurrency,
    baseRunDir: resolve(baseRunDir),
  };
}

async function main() {
  try {
    const options = parseArgs();

    console.error(`[MCP Server] Discovering task packs from: ${options.packs.join(', ')}`);

    // Discover packs
    const discoveredPacks = await discoverPacks({
      directories: options.packs,
      nested: true,
    });

    if (discoveredPacks.length === 0) {
      console.error('Error: No valid task packs found in the specified directories');
      process.exit(1);
    }

    console.error(`[MCP Server] Discovered ${discoveredPacks.length} task pack(s):`);
    for (const { pack, toolName } of discoveredPacks) {
      console.error(`[MCP Server]   - ${toolName} (${pack.metadata.id} v${pack.metadata.version})`);
    }

    // Warn if headful requested but no DISPLAY
    if (options.headful && !process.env.DISPLAY) {
      console.error(
        '[MCP Server] Warning: Headful mode requested but DISPLAY not set. ' +
        'Will fall back to headless. Set DISPLAY or use xvfb-run to enable headful mode.'
      );
    }

    // Create and start MCP server
    await createMCPServer({
      packs: discoveredPacks,
      baseRunDir: options.baseRunDir,
      concurrency: options.concurrency,
      headful: options.headful,
    });

    // Server runs indefinitely
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MCP Server] Fatal error: ${errorMessage}`);
    process.exit(1);
  }
}

main();
