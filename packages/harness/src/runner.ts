import { join } from 'path';
import type { TaskPack, RunResult } from '@mcpify/core';
import { runTaskPack } from '@mcpify/core';
import { JSONLLogger } from './logger.js';

/**
 * Runs a task pack with Playwright
 * Wrapper around the shared runTaskPack function
 */
export class TaskPackRunner {
  private logger: JSONLLogger;
  private runsDir: string;

  constructor(runsDir: string) {
    this.runsDir = runsDir;
    this.logger = new JSONLLogger(runsDir);
  }

  async run(
    taskPack: TaskPack,
    inputs: Record<string, unknown>,
    options?: { headful?: boolean }
  ): Promise<RunResult> {
    const result = await runTaskPack(taskPack, inputs, {
      runDir: this.runsDir,
      logger: this.logger,
      headless: options?.headful !== true,
    });

    // Return just the RunResult part (without paths)
    return {
      collectibles: result.collectibles,
      meta: result.meta,
    };
  }
}
