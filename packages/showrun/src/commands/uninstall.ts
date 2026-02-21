/**
 * showrun uninstall - Remove ShowRun and its data
 */

import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { getGlobalConfigDir, getGlobalDataDir } from '@showrun/core';

export function printUninstallHelp(): void {
  console.log(`
Usage: showrun uninstall [options]

Remove ShowRun and clean up associated data.

This will:
  1. Remove the npm global package (npm uninstall -g showrun)
  2. Remove Camoufox browser data
  3. Optionally remove data directory (databases, run logs)
  4. Optionally remove config directory (prompts if not --all)

Options:
  --all                 Also remove config directory (no prompt)
  --keep-config         Keep config directory (no prompt)
  --dry-run             Show what would be removed without removing anything

Examples:
  showrun uninstall                  # Interactive — asks about config
  showrun uninstall --all            # Remove everything including config
  showrun uninstall --keep-config    # Remove everything except config
  showrun uninstall --dry-run        # Preview what would be removed
`);
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

export async function cmdUninstall(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const removeAll = args.includes('--all');
  const keepConfig = args.includes('--keep-config');

  const configDir = getGlobalConfigDir();
  const dataDir = getGlobalDataDir();
  const home = homedir();

  // Camoufox stores data in ~/.cache/camoufox or platform equivalent
  const camoufoxDirs = [
    join(home, '.cache', 'camoufox'),
    join(home, '.cache', 'camoufox-js'),
  ];

  console.log('');
  console.log('ShowRun Uninstaller');
  console.log('===================');
  console.log('');

  // 1. npm global package
  console.log('Will remove:');
  console.log('  - npm global package: showrun');

  // 2. Camoufox data
  const existingCamoufoxDirs = camoufoxDirs.filter((d) => existsSync(d));
  for (const dir of existingCamoufoxDirs) {
    console.log(`  - Camoufox data: ${dir}`);
  }
  if (existingCamoufoxDirs.length === 0) {
    console.log('  - Camoufox data: (not found)');
  }

  // 3. Data directory
  const dataExists = existsSync(dataDir);
  if (dataExists) {
    if (removeAll) {
      console.log(`  - Data directory: ${dataDir}`);
    } else {
      console.log(`  - Data directory: ${dataDir} (will ask)`);
    }
  }

  // 4. Config directory
  const configExists = existsSync(configDir);
  if (configExists) {
    if (removeAll) {
      console.log(`  - Config directory: ${configDir}`);
    } else if (keepConfig) {
      console.log(`  - Config directory: ${configDir} (keeping)`);
    } else {
      console.log(`  - Config directory: ${configDir} (will ask)`);
    }
  }

  console.log('');

  if (dryRun) {
    console.log('[dry-run] No changes made.');
    return;
  }

  // Confirm
  const proceed = await confirm('Proceed with uninstall? [y/N] ');
  if (!proceed) {
    console.log('Cancelled.');
    return;
  }

  // Remove camoufox data
  for (const dir of existingCamoufoxDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log(`  Removed ${dir}`);
    } catch (err) {
      console.warn(`  Failed to remove ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Handle data directory
  if (dataExists) {
    let shouldRemoveData = removeAll;
    if (!shouldRemoveData) {
      shouldRemoveData = await confirm(
        `Remove data directory at ${dataDir}? This includes databases and run logs. [y/N] `,
      );
    }
    if (shouldRemoveData) {
      try {
        rmSync(dataDir, { recursive: true, force: true });
        console.log(`  Removed ${dataDir}`);
      } catch (err) {
        console.warn(`  Failed to remove ${dataDir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log(`  Kept ${dataDir}`);
    }
  }

  // Handle config directory
  if (configExists && !keepConfig) {
    let shouldRemoveConfig = removeAll;
    if (!shouldRemoveConfig) {
      shouldRemoveConfig = await confirm(
        `Remove config directory at ${configDir}? [y/N] `,
      );
    }
    if (shouldRemoveConfig) {
      try {
        rmSync(configDir, { recursive: true, force: true });
        console.log(`  Removed ${configDir}`);
      } catch (err) {
        console.warn(`  Failed to remove ${configDir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log(`  Kept ${configDir}`);
    }
  }

  // npm uninstall -g (do this last since it removes the binary we're running from)
  console.log('');
  console.log('To complete the uninstall, run:');
  console.log('  npm uninstall -g showrun');
  console.log('');
  console.log('(We cannot remove ourselves while running.)');
}
