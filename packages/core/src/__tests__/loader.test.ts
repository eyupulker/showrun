import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskPackLoader } from '../loader.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual as any,
    readFile: vi.fn(),
  };
});

describe('TaskPackLoader Async Methods', () => {
  const packPath = 'fake-pack';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadManifestAsync', () => {
    it('throws error if manifest is missing', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValueOnce(error);

      await expect(TaskPackLoader.loadManifestAsync(packPath)).rejects.toThrow(
        `Task pack manifest not found: ${join(packPath, 'taskpack.json')}`
      );
    });

    it('throws error if manifest parsing fails', async () => {
      vi.mocked(readFile).mockResolvedValueOnce('invalid-json');

      await expect(TaskPackLoader.loadManifestAsync(packPath)).rejects.toThrow(
        'Failed to parse taskpack.json'
      );
    });

    it('throws error if required fields are missing', async () => {
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ id: 'test' }));

      await expect(TaskPackLoader.loadManifestAsync(packPath)).rejects.toThrow(
        'taskpack.json missing required fields'
      );
    });

    it('throws error if kind is not json-dsl', async () => {
      vi.mocked(readFile).mockResolvedValueOnce(
        JSON.stringify({ id: 'test', name: 'Test', version: '1.0.0', kind: 'other' })
      );

      await expect(TaskPackLoader.loadManifestAsync(packPath)).rejects.toThrow(
        'taskpack.json must have "kind": "json-dsl"'
      );
    });

    it('returns manifest if valid', async () => {
      const manifest = { id: 'test', name: 'Test', version: '1.0.0', kind: 'json-dsl' };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(manifest));

      const result = await TaskPackLoader.loadManifestAsync(packPath);
      expect(result).toEqual(manifest);
    });
  });

  describe('loadSecretsAsync', () => {
    it('returns empty object if secrets file is missing', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValueOnce(error);

      const result = await TaskPackLoader.loadSecretsAsync(packPath);
      expect(result).toEqual({});
    });

    it('returns empty object and warns if version is unsupported', async () => {
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ version: 2, secrets: {} }));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await TaskPackLoader.loadSecretsAsync(packPath);
      expect(result).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported secrets file version'));
      warnSpy.mockRestore();
    });

    it('returns secrets if valid', async () => {
      const secrets = { API_KEY: 'secret' };
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ version: 1, secrets }));

      const result = await TaskPackLoader.loadSecretsAsync(packPath);
      expect(result).toEqual(secrets);
    });
  });

  describe('loadTaskPack', () => {
    it('loads task pack successfully', async () => {
      const manifest = { id: 'test', name: 'Test', version: '1.0.0', kind: 'json-dsl' };
      const flowData = { flow: [] };

      // 1. loadManifestAsync calls readFile for taskpack.json
      // 2. loadTaskPack calls readFile for flow.json
      // 3. loadSnapshotsAsync calls readFile for snapshots.json
      vi.mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(manifest)) // taskpack.json
        .mockResolvedValueOnce(JSON.stringify(flowData)) // flow.json
        .mockRejectedValueOnce({ code: 'ENOENT' }); // snapshots.json

      const result = await TaskPackLoader.loadTaskPack(packPath);
      expect(result.metadata.id).toBe('test');
      expect(result.flow).toEqual([]);
    });

    it('throws error if flow.json is missing', async () => {
      const manifest = { id: 'test', name: 'Test', version: '1.0.0', kind: 'json-dsl' };
      const enoent = new Error('Not found');
      (enoent as any).code = 'ENOENT';

      vi.mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(manifest)) // taskpack.json
        .mockRejectedValueOnce(enoent); // flow.json

      await expect(TaskPackLoader.loadTaskPack(packPath)).rejects.toThrow(
        `flow.json not found for json-dsl pack: ${join(packPath, 'flow.json')}`
      );
    });
  });
});
