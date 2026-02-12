/**
 * In-memory ResultStoreProvider — for tests and ephemeral usage.
 */
import { search as jmesSearch, type JSONValue } from '@jmespath-community/jmespath';
import type {
  ResultStoreProvider,
  StorageCapability,
  StoredResult,
  ListOptions,
  ResultSummary,
  FilterOptions,
} from '@showrun/core';

export class InMemoryResultStore implements ResultStoreProvider {
  private data = new Map<string, StoredResult>();

  capabilities(): StorageCapability[] {
    return ['get', 'store', 'list', 'delete', 'filter'];
  }

  async store(result: StoredResult): Promise<void> {
    const existing = this.data.get(result.key);
    const nextVersion = existing ? existing.version + 1 : 1;
    this.data.set(result.key, { ...result, version: nextVersion });
  }

  async get(key: string): Promise<StoredResult | null> {
    return this.data.get(key) ?? null;
  }

  async list(options?: ListOptions): Promise<{ results: ResultSummary[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const sortBy = options?.sortBy ?? 'storedAt';
    const sortDir = options?.sortDir ?? 'desc';

    let entries = Array.from(this.data.values());

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    entries.sort((a, b) => {
      const aVal = sortBy === 'ranAt' ? a.ranAt : a.storedAt;
      const bVal = sortBy === 'ranAt' ? b.ranAt : b.storedAt;
      return aVal < bVal ? -dir : aVal > bVal ? dir : 0;
    });

    const total = entries.length;
    entries = entries.slice(offset, offset + limit);

    const results: ResultSummary[] = entries.map((e) => ({
      key: e.key,
      packId: e.packId,
      toolName: e.toolName,
      storedAt: e.storedAt,
      version: e.version,
      fieldCount: Object.keys(e.collectibles).length,
    }));

    return { results, total };
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async filter(options: FilterOptions): Promise<{ data: unknown; total?: number }> {
    const stored = this.data.get(options.key);
    if (!stored) return { data: null, total: 0 };

    let data: unknown = structuredClone(stored.collectibles);

    if (options.jmesPath) {
      try {
        data = jmesSearch(data as JSONValue, options.jmesPath);
      } catch {
        return { data: null, total: 0 };
      }
    }

    if (Array.isArray(data) && options.sortBy) {
      const dir = options.sortDir === 'desc' ? -1 : 1;
      const field = options.sortBy;
      data = [...data].sort((a, b) => {
        const aVal = a?.[field];
        const bVal = b?.[field];
        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return aVal < bVal ? -dir : dir;
      });
    }

    let total: number | undefined;
    if (Array.isArray(data)) {
      total = data.length;
      const off = options.offset ?? 0;
      const lim = options.limit ?? data.length;
      data = data.slice(off, off + lim);
    }

    return { data, total };
  }

  async close(): Promise<void> {
    this.data.clear();
  }
}
