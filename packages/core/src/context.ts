import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright';
import type { NetworkCaptureApi } from './networkCapture.js';
import type { ArtifactManager, Logger, RunContext } from './types.js';

/**
 * Creates a RunContext for task pack execution
 */
export class RunContextFactory {
  static create(
    page: Page,
    browser: Browser,
    logger: Logger,
    artifactsDir: string,
    networkCapture?: NetworkCaptureApi
  ): RunContext {
    // Ensure artifacts directory exists
    mkdirSync(artifactsDir, { recursive: true });

    const artifacts: ArtifactManager = {
      async saveScreenshot(name: string): Promise<string> {
        const path = join(artifactsDir, `${name}.png`);
        await page.screenshot({ path, fullPage: true });
        return path;
      },
      async saveHTML(name: string, html: string): Promise<string> {
        const path = join(artifactsDir, `${name}.html`);
        writeFileSync(path, html, 'utf-8');
        return path;
      },
    };

    return {
      page,
      browser,
      logger,
      artifacts,
      networkCapture,
    };
  }
}
