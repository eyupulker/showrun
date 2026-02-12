/**
 * SQLite-backed ResultStoreProvider.
 *
 * Each pack gets its own `results.db` in its pack directory.
 * Uses WAL mode and UPSERT for safe concurrent access.
 */
import Database from 'better-sqlite3';
import { search as jmesSearch, type JSONValue } from '@jmespath-community/jmespath';
import type {
  ResultStoreProvider,
  StorageCapability,
  StoredResult,
  ListOptions,
  ResultSummary,
  FilterOptions,
} from '@showrun/core';

export class SQLiteResultStore implements ResultStoreProvider {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  // ---------------------------------------------------------------------------
  // Schema
  // ---------------------------------------------------------------------------

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS result_store (
        key            TEXT PRIMARY KEY,
        pack_id        TEXT NOT NULL,
        tool_name      TEXT NOT NULL,
        inputs_json    TEXT NOT NULL,
        collectibles_json TEXT NOT NULL,
        meta_json      TEXT NOT NULL,
        schema_json    TEXT NOT NULL,
        stored_at      TEXT NOT NULL,
        ran_at         TEXT NOT NULL,
        version        INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_result_store_stored_at
        ON result_store(stored_at);
    `);
  }

  // ---------------------------------------------------------------------------
  // Capabilities
  // ---------------------------------------------------------------------------

  capabilities(): StorageCapability[] {
    return ['get', 'store', 'list', 'delete', 'filter'];
  }

  // ---------------------------------------------------------------------------
  // Core CRUD
  // ---------------------------------------------------------------------------

  async store(result: StoredResult): Promise<void> {
    const existing = this.db
      .prepare('SELECT version FROM result_store WHERE key = ?')
      .get(result.key) as { version: number } | undefined;

    const nextVersion = existing ? existing.version + 1 : 1;

    this.db
      .prepare(
        `INSERT INTO result_store (key, pack_id, tool_name, inputs_json, collectibles_json, meta_json, schema_json, stored_at, ran_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           pack_id = excluded.pack_id,
           tool_name = excluded.tool_name,
           inputs_json = excluded.inputs_json,
           collectibles_json = excluded.collectibles_json,
           meta_json = excluded.meta_json,
           schema_json = excluded.schema_json,
           stored_at = excluded.stored_at,
           ran_at = excluded.ran_at,
           version = ?`,
      )
      .run(
        result.key,
        result.packId,
        result.toolName,
        JSON.stringify(result.inputs),
        JSON.stringify(result.collectibles),
        JSON.stringify(result.meta),
        JSON.stringify(result.collectibleSchema),
        result.storedAt,
        result.ranAt,
        nextVersion,
        nextVersion,
      );
  }

  async get(key: string): Promise<StoredResult | null> {
    const row = this.db
      .prepare('SELECT * FROM result_store WHERE key = ?')
      .get(key) as RawRow | undefined;

    return row ? rowToResult(row) : null;
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async list(options?: ListOptions): Promise<{ results: ResultSummary[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const sortBy = options?.sortBy ?? 'storedAt';
    const sortDir = options?.sortDir ?? 'desc';

    const col = sortBy === 'ranAt' ? 'ran_at' : 'stored_at';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const totalRow = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM result_store')
      .get() as { cnt: number };

    const rows = this.db
      .prepare(
        `SELECT key, pack_id, tool_name, stored_at, version, collectibles_json
         FROM result_store ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Array<{
        key: string;
        pack_id: string;
        tool_name: string;
        stored_at: string;
        version: number;
        collectibles_json: string;
      }>;

    const results: ResultSummary[] = rows.map((r) => {
      let fieldCount = 0;
      try {
        fieldCount = Object.keys(JSON.parse(r.collectibles_json)).length;
      } catch { /* ignore */ }

      return {
        key: r.key,
        packId: r.pack_id,
        toolName: r.tool_name,
        storedAt: r.stored_at,
        version: r.version,
        fieldCount,
      };
    });

    return { results, total: totalRow.cnt };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(key: string): Promise<boolean> {
    const info = this.db
      .prepare('DELETE FROM result_store WHERE key = ?')
      .run(key);
    return info.changes > 0;
  }

  // ---------------------------------------------------------------------------
  // Filter (JMESPath in-memory)
  // ---------------------------------------------------------------------------

  async filter(options: FilterOptions): Promise<{ data: unknown; total?: number }> {
    const row = this.db
      .prepare('SELECT collectibles_json FROM result_store WHERE key = ?')
      .get(options.key) as { collectibles_json: string } | undefined;

    if (!row) {
      return { data: null, total: 0 };
    }

    let data: unknown = JSON.parse(row.collectibles_json);

    // Apply JMESPath
    if (options.jmesPath) {
      try {
        data = jmesSearch(data as JSONValue, options.jmesPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { data: null, total: 0 };
      }
    }

    // Sort (only for arrays of objects)
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

    // Paginate (only for arrays)
    let total: number | undefined;
    if (Array.isArray(data)) {
      total = data.length;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? data.length;
      data = data.slice(offset, offset + limit);
    }

    return { data, total };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async close(): Promise<void> {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawRow {
  key: string;
  pack_id: string;
  tool_name: string;
  inputs_json: string;
  collectibles_json: string;
  meta_json: string;
  schema_json: string;
  stored_at: string;
  ran_at: string;
  version: number;
}

function rowToResult(row: RawRow): StoredResult {
  return {
    key: row.key,
    packId: row.pack_id,
    toolName: row.tool_name,
    inputs: JSON.parse(row.inputs_json),
    collectibles: JSON.parse(row.collectibles_json),
    meta: JSON.parse(row.meta_json),
    collectibleSchema: JSON.parse(row.schema_json),
    storedAt: row.stored_at,
    ranAt: row.ran_at,
    version: row.version,
  };
}
