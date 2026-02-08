import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { saveVersion, listVersions, restoreVersion, getVersionFiles } from '../packVersioning.js';

function createTempPack(opts?: { version?: string }): string {
  const dir = join(tmpdir(), `test-pack-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });

  const taskpack = {
    id: 'test-pack',
    name: 'Test Pack',
    version: opts?.version || '1.0.0',
    kind: 'json-dsl',
  };
  writeFileSync(join(dir, 'taskpack.json'), JSON.stringify(taskpack, null, 2));

  const flow = {
    inputs: {},
    collectibles: [],
    flow: [{ id: 'step1', type: 'navigate', params: { url: 'https://example.com' } }],
  };
  writeFileSync(join(dir, 'flow.json'), JSON.stringify(flow, null, 2));

  return dir;
}

describe('Pack Versioning', () => {
  let packDir: string;

  beforeEach(() => {
    packDir = createTempPack();
  });

  afterEach(() => {
    try {
      rmSync(packDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('saves a version and creates versioned files', () => {
    const v = saveVersion(packDir, { source: 'cli', label: 'Initial' });

    expect(v.number).toBe(1);
    expect(v.version).toBe('1.0.0');
    expect(v.source).toBe('cli');
    expect(v.label).toBe('Initial');
    expect(v.timestamp).toBeTruthy();

    expect(existsSync(join(packDir, '.versions', '1.flow.json'))).toBe(true);
    expect(existsSync(join(packDir, '.versions', '1.taskpack.json'))).toBe(true);
    expect(existsSync(join(packDir, '.versions', 'manifest.json'))).toBe(true);
  });

  it('reads version field from taskpack.json metadata', () => {
    const v = saveVersion(packDir, { source: 'dashboard' });
    expect(v.version).toBe('1.0.0');

    // Update version and save again
    const taskpackPath = join(packDir, 'taskpack.json');
    const taskpack = JSON.parse(readFileSync(taskpackPath, 'utf-8'));
    taskpack.version = '2.0.0';
    writeFileSync(taskpackPath, JSON.stringify(taskpack, null, 2));

    const v2 = saveVersion(packDir, { source: 'cli' });
    expect(v2.version).toBe('2.0.0');
    expect(v2.number).toBe(2);
  });

  it('increments version numbers', () => {
    const v1 = saveVersion(packDir, { source: 'cli' });
    const v2 = saveVersion(packDir, { source: 'cli' });
    const v3 = saveVersion(packDir, { source: 'cli' });

    expect(v1.number).toBe(1);
    expect(v2.number).toBe(2);
    expect(v3.number).toBe(3);
  });

  it('lists versions', () => {
    saveVersion(packDir, { source: 'cli', label: 'First' });
    saveVersion(packDir, { source: 'dashboard', label: 'Second' });

    const versions = listVersions(packDir);
    expect(versions).toHaveLength(2);
    expect(versions[0].label).toBe('First');
    expect(versions[1].label).toBe('Second');
  });

  it('returns empty array when no versions exist', () => {
    const versions = listVersions(packDir);
    expect(versions).toEqual([]);
  });

  it('restores a version', () => {
    // Save version 1 with original flow
    saveVersion(packDir, { source: 'cli', label: 'Original' });

    // Modify flow
    const flowPath = join(packDir, 'flow.json');
    const modified = {
      inputs: {},
      collectibles: [],
      flow: [{ id: 'modified', type: 'navigate', params: { url: 'https://modified.com' } }],
    };
    writeFileSync(flowPath, JSON.stringify(modified, null, 2));

    // Restore version 1
    restoreVersion(packDir, 1);

    // Root flow should match version 1
    const restored = JSON.parse(readFileSync(flowPath, 'utf-8'));
    expect(restored.flow[0].id).toBe('step1');
    expect(restored.flow[0].params.url).toBe('https://example.com');
  });

  it('auto-saves current state before restoring', () => {
    saveVersion(packDir, { source: 'cli', label: 'Original' });

    // Modify flow
    const flowPath = join(packDir, 'flow.json');
    writeFileSync(flowPath, JSON.stringify({ flow: [{ id: 'new', type: 'navigate', params: { url: 'https://new.com' } }] }));

    restoreVersion(packDir, 1);

    // Should have 3 versions: original, auto-save, (version 1 was already there)
    const versions = listVersions(packDir);
    expect(versions).toHaveLength(2);
    const autoSave = versions.find((v) => v.label?.includes('Auto-saved before restoring'));
    expect(autoSave).toBeTruthy();
  });

  it('throws when restoring nonexistent version', () => {
    expect(() => restoreVersion(packDir, 999)).toThrow('Version 999 not found');
  });

  it('getVersionFiles reads versioned files without restoring', () => {
    saveVersion(packDir, { source: 'cli' });

    // Modify current flow
    const flowPath = join(packDir, 'flow.json');
    writeFileSync(flowPath, JSON.stringify({ flow: [{ id: 'changed', type: 'navigate', params: { url: 'https://changed.com' } }] }));

    // getVersionFiles should return the original
    const files = getVersionFiles(packDir, 1);
    expect((files.flow as any).flow[0].id).toBe('step1');

    // Current flow should still be changed
    const current = JSON.parse(readFileSync(flowPath, 'utf-8'));
    expect(current.flow[0].id).toBe('changed');
  });

  it('throws when getting files for nonexistent version', () => {
    expect(() => getVersionFiles(packDir, 999)).toThrow('Version 999 not found');
  });

  it('handles missing taskpack.json in old version gracefully', () => {
    saveVersion(packDir, { source: 'cli' });

    // Delete the versioned taskpack.json
    const vTaskpack = join(packDir, '.versions', '1.taskpack.json');
    rmSync(vTaskpack);

    // getVersionFiles should still work with null taskpack
    const files = getVersionFiles(packDir, 1);
    expect(files.flow).toBeTruthy();
    expect(files.taskpack).toBeNull();
  });

  it('prunes oldest versions when exceeding maxVersions', () => {
    // Set a low maxVersions
    const manifestPath = join(packDir, '.versions', 'manifest.json');
    mkdirSync(join(packDir, '.versions'), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ versions: [], maxVersions: 3 }));

    // Save 5 versions
    for (let i = 0; i < 5; i++) {
      saveVersion(packDir, { source: 'cli', label: `v${i}` });
    }

    const versions = listVersions(packDir);
    expect(versions).toHaveLength(3);
    // Oldest should have been pruned — remaining should be versions 3, 4, 5
    expect(versions[0].number).toBe(3);
    expect(versions[1].number).toBe(4);
    expect(versions[2].number).toBe(5);

    // Pruned versioned files should be deleted
    expect(existsSync(join(packDir, '.versions', '1.flow.json'))).toBe(false);
    expect(existsSync(join(packDir, '.versions', '2.flow.json'))).toBe(false);
  });

  it('saves conversationId when provided', () => {
    const v = saveVersion(packDir, {
      source: 'agent',
      conversationId: 'conv-abc123',
      label: 'Agent save',
    });

    expect(v.conversationId).toBe('conv-abc123');

    const versions = listVersions(packDir);
    expect(versions[0].conversationId).toBe('conv-abc123');
  });
});
