#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync } from 'fs';
import { TaskPackLoader } from '@mcpify/core';
import { TaskPackRunner } from './runner.js';
import { mkdirSync } from 'fs';
import { join } from 'path';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const EXIT_VALIDATION_ERROR = 2;

function parseArgs(): { pack: string; inputs: Record<string, unknown>; headful: boolean } {
  const args = process.argv.slice(2);
  let packPath: string | null = null;
  let inputsJson: string | null = null;
  let headful = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pack' && i + 1 < args.length) {
      packPath = args[i + 1];
      i++;
    } else if (args[i] === '--inputs' && i + 1 < args.length) {
      inputsJson = args[i + 1];
      i++;
    } else if (args[i] === '--headful') {
      headful = true;
    }
  }

  if (!packPath) {
    console.error('Error: --pack <path> is required');
    process.exit(EXIT_VALIDATION_ERROR);
  }

  if (!inputsJson) {
    inputsJson = '{}';
  }

  let inputs: Record<string, unknown>;
  try {
    inputs = JSON.parse(inputsJson);
  } catch (error) {
    console.error(`Error: Invalid JSON in --inputs: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(EXIT_VALIDATION_ERROR);
  }

  return { pack: packPath, inputs, headful };
}

async function main() {
  try {
    const { pack: packPath, inputs, headful } = parseArgs();
    const resolvedPackPath = resolve(packPath);

    if (!existsSync(resolvedPackPath)) {
      console.error(`Error: Task pack directory not found: ${resolvedPackPath}`);
      process.exit(EXIT_VALIDATION_ERROR);
    }

    // Load task pack
    const taskPack = await TaskPackLoader.loadTaskPack(resolvedPackPath);

    // Create runs directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const runsDir = join(process.cwd(), 'runs', timestamp);
    mkdirSync(runsDir, { recursive: true });

    // Run task pack
    const runner = new TaskPackRunner(runsDir);
    const result = await runner.run(taskPack, inputs, { headful });

    // Output result
    console.log(JSON.stringify(result, null, 2));
    process.exit(EXIT_SUCCESS);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('validation failed') || errorMessage.includes('Missing required field')) {
      console.error(`Validation Error: ${errorMessage}`);
      process.exit(EXIT_VALIDATION_ERROR);
    }

    console.error(`Error: ${errorMessage}`);
    process.exit(EXIT_FAILURE);
  }
}

main();
