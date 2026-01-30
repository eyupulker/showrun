import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'fs';
import { join, resolve, dirname } from 'path';
import type { TaskPackManifest, InputSchema, CollectibleDefinition } from '@mcpify/core';
import type { DslStep } from '@mcpify/core';
import { validateJsonTaskPack } from '@mcpify/core';

/**
 * Sanitize a pack ID to be safe for use as a directory name
 */
export function sanitizePackId(packId: string): string {
  // Replace invalid characters with underscores
  return packId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Atomic write: write to temp file then rename
 */
export function atomicWrite(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`;
  try {
    writeFileSync(tempPath, content, 'utf-8');
    renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      if (existsSync(tempPath)) {
        renameSync(tempPath, filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Validate that a path is within an allowed directory
 */
export function validatePathInAllowedDir(path: string, allowedDir: string): void {
  const resolvedPath = resolve(path);
  const resolvedAllowed = resolve(allowedDir);
  
  if (!resolvedPath.startsWith(resolvedAllowed + '/') && resolvedPath !== resolvedAllowed) {
    throw new Error(`Path ${resolvedPath} is outside allowed directory ${resolvedAllowed}`);
  }
}

/**
 * Read JSON file safely
 */
export function readJsonFile<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write taskpack.json
 */
export function writeTaskPackManifest(
  packDir: string,
  manifest: TaskPackManifest
): void {
  const manifestPath = join(packDir, 'taskpack.json');
  const content = JSON.stringify(manifest, null, 2) + '\n';
  atomicWrite(manifestPath, content);
}

/**
 * Write flow.json
 */
export function writeFlowJson(
  packDir: string,
  flowData: {
    inputs?: InputSchema;
    collectibles?: CollectibleDefinition[];
    flow: DslStep[];
  }
): void {
  // Validate before writing
  const taskPack = {
    metadata: {
      id: 'temp',
      name: 'temp',
      version: '0.0.0',
    },
    inputs: flowData.inputs || {},
    collectibles: flowData.collectibles || [],
    flow: flowData.flow,
  };
  
  validateJsonTaskPack(taskPack);

  const flowPath = join(packDir, 'flow.json');
  const content = JSON.stringify(flowData, null, 2) + '\n';
  atomicWrite(flowPath, content);
}
