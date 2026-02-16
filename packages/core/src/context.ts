import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Browser, Page } from 'playwright';
import type { Logger, ArtifactManager, RunContext } from './types.js';
import type { NetworkCaptureApi } from './networkCapture.js';

/**
 * Creates a RunContext for task pack execution
 */
export class RunContextFactory {
  static create(
    page: Page,
    browser: Browser,
    logger: Logger,
    artifactsDir: string,
    networkCapture?: NetworkCaptureApi,
    screenshotQuality?: number
  ): RunContext {
    // Ensure artifacts directory exists
    mkdirSync(artifactsDir, { recursive: true });

    const quality = screenshotQuality ?? 80;

    const artifacts: ArtifactManager = {
      async saveScreenshot(name: string): Promise<string> {
        let path = join(artifactsDir, `${name}.webp`);
        try {
          await page.screenshot({ path, type: 'webp', quality, fullPage: true });
        } catch (e) {
          // Fallback to JPEG if WebP is not supported
          path = join(artifactsDir, `${name}.jpg`);
          await page.screenshot({ path, type: 'jpeg', quality, fullPage: true });
        }
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
