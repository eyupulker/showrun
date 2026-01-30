import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { TaskPack, RunResult, RunContext } from './types.js';
import { InputValidator, RunContextFactory, runFlow, attachNetworkCapture } from './index.js';
import type { Logger } from './types.js';

/**
 * Options for running a task pack
 */
export interface RunTaskPackOptions {
  /**
   * Directory to store run artifacts and logs
   */
  runDir: string;
  /**
   * Logger instance for structured logging
   */
  logger: Logger;
  /**
   * Whether to run browser in headless mode (default: true)
   */
  headless?: boolean;
  /**
   * Session ID for "once" step caching (session scope)
   */
  sessionId?: string;
  /**
   * Profile ID for "once" step caching (profile scope)
   */
  profileId?: string;
}

/**
 * Result of running a task pack with paths
 */
export interface RunTaskPackResult extends RunResult {
  /**
   * Path to the run directory
   */
  runDir: string;
  /**
   * Path to the events JSONL file
   */
  eventsPath: string;
  /**
   * Path to the artifacts directory
   */
  artifactsDir: string;
}

/**
 * Runs a task pack with Playwright
 * This is a reusable function that can be used by both CLI and MCP server
 */
export async function runTaskPack(
  taskPack: TaskPack,
  inputs: Record<string, unknown>,
  options: RunTaskPackOptions
): Promise<RunTaskPackResult> {
  const { runDir, logger, headless: requestedHeadless = true } = options;
  const artifactsDir = join(runDir, 'artifacts');
  const eventsPath = join(runDir, 'events.jsonl');

  // Ensure directories exist
  mkdirSync(runDir, { recursive: true });
  mkdirSync(artifactsDir, { recursive: true });

  // Auto-detect if we can run headful (check for DISPLAY)
  // If headful was requested but no DISPLAY is available, fall back to headless
  const hasDisplay = !!process.env.DISPLAY;
  const headless = requestedHeadless || !hasDisplay;

  if (!requestedHeadless && !hasDisplay) {
    console.error(
      '[Warning] Headful mode requested but no DISPLAY environment variable found. ' +
      'Falling back to headless mode. Set DISPLAY or use xvfb-run to enable headful mode.'
    );
  }

  const startTime = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;
  let runContext: RunContext | null = null;

  try {
    // Validate inputs
    InputValidator.validate(inputs, taskPack.inputs);

    // Log run start
    logger.log({
      type: 'run_started',
      data: {
        packId: taskPack.metadata.id,
        packVersion: taskPack.metadata.version,
        inputs,
      },
    });

    // Launch browser
    browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    page = await context.newPage();

    // Attach network capture (rolling buffer, redacted for logs; full headers in-memory for replay only)
    const networkCapture = attachNetworkCapture(page);

    // Create run context
    runContext = RunContextFactory.create(
      page,
      browser,
      logger,
      artifactsDir,
      networkCapture
    );

    // Execute task pack - prefer declarative flow if present
    let result: RunResult;
    if (taskPack.flow) {
      // Use declarative DSL flow
      const flowResult = await runFlow(runContext, taskPack.flow, {
        inputs,
        auth: taskPack.auth,
        sessionId: options.sessionId,
        profileId: options.profileId,
      });
      // Convert RunFlowResult to RunResult format
      result = {
        collectibles: flowResult.collectibles,
        meta: {
          url: flowResult.meta.url,
          durationMs: flowResult.meta.durationMs,
          notes: `Executed ${flowResult.meta.stepsExecuted}/${flowResult.meta.stepsTotal} steps`,
        },
      };
    } else if (taskPack.run) {
      // Use imperative run function
      result = await taskPack.run(runContext, inputs);
    } else {
      throw new Error(
        'Task pack must have either a "flow" array or a "run" function'
      );
    }

    const durationMs = Date.now() - startTime;

    // Log run finish
    logger.log({
      type: 'run_finished',
      data: {
        success: true,
        durationMs,
      },
    });

    return {
      ...result,
      runDir,
      eventsPath,
      artifactsDir,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log error
    logger.log({
      type: 'error',
      data: {
        error: errorMessage,
      },
    });

    // Save artifacts on error
    if (page) {
      try {
        if (runContext) {
          await runContext.artifacts.saveScreenshot('error');
          const html = await page.content();
          await runContext.artifacts.saveHTML('error', html);
        } else {
          // Fallback: save artifacts directly if runContext wasn't created
          const screenshotPath = join(artifactsDir, 'error.png');
          await page.screenshot({ path: screenshotPath, fullPage: true });
          const html = await page.content();
          const htmlPath = join(artifactsDir, 'error.html');
          writeFileSync(htmlPath, html, 'utf-8');
        }
      } catch (artifactError) {
        // Ignore artifact save errors
        console.error('Failed to save artifacts:', artifactError);
      }
    }

    // Log run finish with failure
    logger.log({
      type: 'run_finished',
      data: {
        success: false,
        durationMs,
      },
    });

    // Return partial result with paths even on error
    return {
      collectibles: {},
      meta: {
        durationMs,
        notes: `Error: ${errorMessage}`,
      },
      runDir,
      eventsPath,
      artifactsDir,
    };
  } finally {
    // Cleanup
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
