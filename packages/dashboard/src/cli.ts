#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { cwd } from 'process';
import { startDashboard } from './server.js';

// Load .env from cwd or nearest ancestor (so OPENAI_API_KEY, TEACH_CHAT_SYSTEM_PROMPT, etc. are available)
(function loadEnv() {
  let dir = resolve(cwd());
  const root = resolve('/');
  while (dir !== root) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      config({ path: envPath });
      break;
    }
    dir = resolve(dir, '..');
  }
})();

/**
 * Find the project root by walking up from current directory
 * looking for pnpm-workspace.yaml or package.json with workspaces
 */
function findProjectRoot(startDir: string): string {
  let current = resolve(startDir);
  const root = resolve('/');

  while (current !== root) {
    if (
      existsSync(resolve(current, 'pnpm-workspace.yaml')) ||
      (existsSync(resolve(current, 'package.json')) &&
        existsSync(resolve(current, 'packages')))
    ) {
      return current;
    }
    current = resolve(current, '..');
  }

  // Fallback to current working directory
  return cwd();
}

interface CliArgs {
  packs: string[];
  port: number;
  host?: string;
  headful: boolean;
  baseRunDir: string;
  workspaceDir?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  // Find project root (where pnpm-workspace.yaml or packages/ exists)
  // This handles the case where pnpm --filter changes the working directory
  const projectRoot = findProjectRoot(cwd());
  
  const result: Partial<CliArgs> = {
    packs: [],
    port: 3333,
    headful: false,
    baseRunDir: resolve(projectRoot, './runs-dashboard'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--packs':
        if (!next || next.startsWith('--')) {
          console.error('Error: --packs requires a comma-separated list of directories');
          process.exit(1);
        }
        // Resolve paths relative to project root
        result.packs = next.split(',').map((p) => {
          const trimmed = p.trim();
          // If absolute path, use as-is; otherwise resolve relative to project root
          if (trimmed.startsWith('/')) {
            return trimmed;
          }
          const projectRoot = findProjectRoot(cwd());
          return resolve(projectRoot, trimmed);
        }).filter(Boolean);
        i++;
        break;
      case '--port':
        if (!next || next.startsWith('--')) {
          console.error('Error: --port requires a number');
          process.exit(1);
        }
        result.port = parseInt(next, 10);
        if (isNaN(result.port) || result.port < 1 || result.port > 65535) {
          console.error('Error: --port must be a number between 1 and 65535');
          process.exit(1);
        }
        i++;
        break;
      case '--host':
        if (!next || next.startsWith('--')) {
          console.error('Error: --host requires a hostname or IP address');
          process.exit(1);
        }
        result.host = next;
        i++;
        break;
      case '--headful':
        result.headful = true;
        break;
      case '--baseRunDir':
        if (!next || next.startsWith('--')) {
          console.error('Error: --baseRunDir requires a path');
          process.exit(1);
        }
        // Resolve path relative to project root (if not already absolute)
        if (next.startsWith('/')) {
          result.baseRunDir = next;
        } else {
          const projectRoot = findProjectRoot(cwd());
          result.baseRunDir = resolve(projectRoot, next);
        }
        i++;
        break;
      case '--workspace':
        if (!next || next.startsWith('--')) {
          console.error('Error: --workspace requires a path');
          process.exit(1);
        }
        // Resolve path relative to project root (if not already absolute)
        if (next.startsWith('/')) {
          result.workspaceDir = next;
        } else {
          const projectRoot = findProjectRoot(cwd());
          result.workspaceDir = resolve(projectRoot, next);
        }
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: mcpify-dashboard [options]

Options:
  --packs <dir1,dir2>    Comma-separated list of directories to search for task packs
                         (default: ./taskpacks if exists)
  --port <n>             Port to bind the server to (default: 3333)
  --host <hostname>      Hostname or IP to bind to (default: 127.0.0.1)
                         WARNING: Only use this if you understand the security implications
  --headful              Run browser in headful mode (default: false)
  --baseRunDir <path>    Base directory for run outputs (default: ./runs-dashboard)
  --workspace <path>     Writable directory for JSON pack creation/editing (default: first --packs dir)
  --help, -h             Show this help message

Examples:
  mcpify-dashboard
  mcpify-dashboard --packs ./taskpacks,./custom-packs --port 4000
  mcpify-dashboard --headful --baseRunDir ./my-runs
        `);
        process.exit(0);
        break;
      default:
        console.error(`Error: Unknown argument: ${arg}`);
        console.error('Run with --help for usage information');
        process.exit(1);
    }
  }

  // Default packs directory if not specified
  if (!result.packs || result.packs.length === 0) {
    const projectRoot = findProjectRoot(cwd());
    const defaultPacksDir = resolve(projectRoot, './taskpacks');
    if (existsSync(defaultPacksDir)) {
      result.packs = [defaultPacksDir];
    } else {
      console.error('Error: No --packs directories specified and ./taskpacks does not exist');
      console.error(`Searched in: ${defaultPacksDir}`);
      console.error('Please specify --packs with at least one directory');
      process.exit(1);
    }
  }

  return result as CliArgs;
}

async function main() {
  try {
    const args = parseArgs();
    await startDashboard({
      ...args,
      workspaceDir: args.workspaceDir,
    });
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
