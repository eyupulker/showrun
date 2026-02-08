/**
 * Pack versioning: save, list, and restore snapshots of flow.json + taskpack.json
 */
import { join } from 'path';
import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { ensureDir, readJsonFile, atomicWrite } from './packUtils.js';
import type { FlowVersion, VersionManifest, TaskPackManifest } from './types.js';

const VERSIONS_DIR = '.versions';
const MANIFEST_FILE = 'manifest.json';
const DEFAULT_MAX_VERSIONS = 50;

function versionsDir(packDir: string): string {
  return join(packDir, VERSIONS_DIR);
}

function manifestPath(packDir: string): string {
  return join(versionsDir(packDir), MANIFEST_FILE);
}

function readManifest(packDir: string): VersionManifest {
  const mPath = manifestPath(packDir);
  if (!existsSync(mPath)) {
    return { versions: [], maxVersions: DEFAULT_MAX_VERSIONS };
  }
  return readJsonFile<VersionManifest>(mPath);
}

function writeManifest(packDir: string, manifest: VersionManifest): void {
  ensureDir(versionsDir(packDir));
  atomicWrite(manifestPath(packDir), JSON.stringify(manifest, null, 2) + '\n');
}

function nextVersionNumber(manifest: VersionManifest): number {
  if (manifest.versions.length === 0) return 1;
  return Math.max(...manifest.versions.map((v) => v.number)) + 1;
}

/**
 * Save a version snapshot of the current flow.json and taskpack.json.
 */
export function saveVersion(
  packDir: string,
  opts: {
    label?: string;
    source: FlowVersion['source'];
    conversationId?: string;
  }
): FlowVersion {
  const flowPath = join(packDir, 'flow.json');
  const taskpackPath = join(packDir, 'taskpack.json');

  if (!existsSync(flowPath)) {
    throw new Error(`flow.json not found in ${packDir}`);
  }
  if (!existsSync(taskpackPath)) {
    throw new Error(`taskpack.json not found in ${packDir}`);
  }

  const manifest = readManifest(packDir);
  const num = nextVersionNumber(manifest);
  const vDir = versionsDir(packDir);
  ensureDir(vDir);

  // Read metadata.version from taskpack.json
  const taskpackData = readJsonFile<TaskPackManifest>(taskpackPath);
  const metadataVersion = taskpackData.version || '0.0.0';

  // Copy current files to versioned copies
  copyFileSync(flowPath, join(vDir, `${num}.flow.json`));
  copyFileSync(taskpackPath, join(vDir, `${num}.taskpack.json`));

  const version: FlowVersion = {
    number: num,
    version: metadataVersion,
    timestamp: new Date().toISOString(),
    label: opts.label,
    source: opts.source,
    conversationId: opts.conversationId,
  };

  manifest.versions.push(version);

  // Prune oldest versions if exceeding maxVersions
  const max = manifest.maxVersions || DEFAULT_MAX_VERSIONS;
  while (manifest.versions.length > max) {
    const oldest = manifest.versions.shift()!;
    // Remove old versioned files
    const oldFlow = join(vDir, `${oldest.number}.flow.json`);
    const oldTaskpack = join(vDir, `${oldest.number}.taskpack.json`);
    try { if (existsSync(oldFlow)) unlinkSync(oldFlow); } catch { /* ignore */ }
    try { if (existsSync(oldTaskpack)) unlinkSync(oldTaskpack); } catch { /* ignore */ }
  }

  writeManifest(packDir, manifest);
  return version;
}

/**
 * List all saved versions for a pack. Returns [] if no versions exist.
 */
export function listVersions(packDir: string): FlowVersion[] {
  const manifest = readManifest(packDir);
  return manifest.versions;
}

/**
 * Read the versioned files without restoring them.
 */
export function getVersionFiles(
  packDir: string,
  versionNumber: number
): { flow: unknown; taskpack: unknown } {
  const vDir = versionsDir(packDir);
  const flowPath = join(vDir, `${versionNumber}.flow.json`);
  const taskpackPath = join(vDir, `${versionNumber}.taskpack.json`);

  if (!existsSync(flowPath)) {
    throw new Error(`Version ${versionNumber} not found`);
  }

  const flow = readJsonFile<unknown>(flowPath);
  // taskpack.json may not exist in very old versions — handle gracefully
  const taskpack = existsSync(taskpackPath) ? readJsonFile<unknown>(taskpackPath) : null;

  return { flow, taskpack };
}

/**
 * Restore a previous version. Auto-saves the current state first.
 */
export function restoreVersion(
  packDir: string,
  versionNumber: number
): void {
  // Verify the version exists before auto-saving
  const manifest = readManifest(packDir);
  const target = manifest.versions.find((v) => v.number === versionNumber);
  if (!target) {
    throw new Error(`Version ${versionNumber} not found`);
  }

  const vDir = versionsDir(packDir);
  const versionedFlowPath = join(vDir, `${versionNumber}.flow.json`);
  if (!existsSync(versionedFlowPath)) {
    throw new Error(`Version ${versionNumber} files not found on disk`);
  }

  // Auto-save current state before restoring
  const flowPath = join(packDir, 'flow.json');
  if (existsSync(flowPath)) {
    saveVersion(packDir, {
      label: `Auto-saved before restoring version ${versionNumber}`,
      source: 'dashboard',
    });
  }

  // Restore flow.json
  copyFileSync(versionedFlowPath, flowPath);

  // Restore taskpack.json if the versioned copy exists
  const versionedTaskpackPath = join(vDir, `${versionNumber}.taskpack.json`);
  if (existsSync(versionedTaskpackPath)) {
    const taskpackPath = join(packDir, 'taskpack.json');
    copyFileSync(versionedTaskpackPath, taskpackPath);
  }
}
