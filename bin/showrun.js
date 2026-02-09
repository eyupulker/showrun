#!/usr/bin/env node
/**
 * Bootstrap script for npx github:user/repo usage
 *
 * This script checks if the build exists and runs the CLI.
 * For proper usage, publish to npm and use: npx showrun
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const cliPath = resolve(root, 'packages/showrun/dist/cli.js');

if (!existsSync(cliPath)) {
  console.error('Error: ShowRun CLI not built.');
  console.error('');
  console.error('For GitHub usage, you need to build first:');
  console.error('  git clone https://github.com/useshowrun/showrun');
  console.error('  cd showrun');
  console.error('  pnpm install');
  console.error('  pnpm build');
  console.error('  node packages/showrun/dist/cli.js dashboard');
  console.error('');
  console.error('For easier usage, install from npm:');
  console.error('  npx showrun dashboard');
  process.exit(1);
}

// Forward to the actual CLI
const args = process.argv.slice(2);
const child = spawn('node', [cliPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
