/**
 * Manages run state and history
 * Now backed by SQLite for persistence
 */
import { LRUCache } from 'lru-cache';
import {
  createRun,
  getRun as dbGetRun,
  getAllRuns as dbGetAllRuns,
  updateRun as dbUpdateRun,
  batchUpdateRuns as dbBatchUpdateRuns,
  pruneOldRuns,
  deleteRun as dbDeleteRun,
  dbRunToLegacy,
  type DbRunInfo,
  type LegacyRunInfo,
} from './db.js';

// Keep the legacy RunInfo interface for backward compatibility
export interface RunInfo {
  runId: string;
  packId: string;
  packName: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  runDir?: string;
  eventsPath?: string;
  artifactsDir?: string;
  collectibles?: Record<string, unknown>;
  meta?: {
    url?: string;
    durationMs: number;
    notes?: string;
  };
  error?: string;
  // New fields from database
  conversationId?: string;
  source?: DbRunInfo['source'];
}

export class RunManager {
  private maxRuns = 1000; // Keep last 1000 runs
  private runCache = new LRUCache<string, RunInfo>({ max: 500, ttl: 5000 });
  private listCache = new LRUCache<string, RunInfo[]>({ max: 50, ttl: 5000 });

  // Write batching
  private pendingUpdates = new Map<string, Partial<RunInfo>>();
  private flushTimeout: NodeJS.Timeout | null = null;

  /**
   * Add a new run
   */
  addRun(run: RunInfo): void {
    // Create in database
    createRun(
      run.packId,
      run.packName,
      run.source || 'dashboard',
      run.conversationId || undefined
    );

    // Invalidate list cache
    this.listCache.clear();

    // If the run already has an ID different from what DB would generate,
    // we need to update it. For now, we'll accept that the runId might change.
    // In practice, callers should use the returned run from addRunAndGet instead.
  }

  /**
   * Add a new run and return the created run info with the database ID
   */
  addRunAndGet(
    packId: string,
    packName: string,
    source: DbRunInfo['source'] = 'dashboard',
    conversationId?: string
  ): RunInfo {
    const dbRun = createRun(packId, packName, source, conversationId);
    const legacy = dbRunToLegacy(dbRun);

    // Prune old runs if needed
    if (this.maxRuns > 0) {
      pruneOldRuns(this.maxRuns);
    }

    // Invalidate list cache
    this.listCache.clear();

    return legacy;
  }

  /**
   * Flush any pending updates to the database
   */
  flushUpdates(): void {
    if (this.pendingUpdates.size === 0) return;

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    // Process all pending updates
    const updatesToApply: Array<{ id: string; updates: Parameters<typeof dbUpdateRun>[1] }> = [];

    for (const [runId, updates] of this.pendingUpdates.entries()) {
      const dbUpdates: Parameters<typeof dbUpdateRun>[1] = {};

      if (updates.status !== undefined) {
        dbUpdates.status = updates.status;
      }
      if (updates.startedAt !== undefined) {
        dbUpdates.startedAt = updates.startedAt;
      }
      if (updates.finishedAt !== undefined) {
        dbUpdates.finishedAt = updates.finishedAt;
      }
      if (updates.durationMs !== undefined) {
        dbUpdates.durationMs = updates.durationMs;
      }
      if (updates.runDir !== undefined) {
        dbUpdates.runDir = updates.runDir;
      }
      if (updates.collectibles !== undefined) {
        dbUpdates.collectiblesJson = JSON.stringify(updates.collectibles);
      }
      if (updates.meta !== undefined) {
        dbUpdates.metaJson = JSON.stringify(updates.meta);
      }
      if (updates.error !== undefined) {
        dbUpdates.errorMessage = updates.error;
      }

      updatesToApply.push({ id: runId, updates: dbUpdates });
    }

    if (updatesToApply.length > 0) {
      dbBatchUpdateRuns(updatesToApply);
    }

    this.pendingUpdates.clear();
  }

  /**
   * Get a run by ID
   */
  getRun(runId: string): RunInfo | undefined {
    // Ensure we have the latest data if there are pending updates for this run
    if (this.pendingUpdates.has(runId)) {
      this.flushUpdates();
    }

    const cached = this.runCache.get(runId);
    if (cached) return cached;

    const dbRun = dbGetRun(runId);
    if (!dbRun) return undefined;

    const run = dbRunToLegacy(dbRun);
    this.runCache.set(runId, run);
    return run;
  }

  /**
   * Update a run (batched)
   */
  updateRun(runId: string, updates: Partial<RunInfo>): void {
    // Invalidate caches
    this.runCache.delete(runId);
    this.listCache.clear();

    // Merge into pending updates
    const existing = this.pendingUpdates.get(runId) || {};
    this.pendingUpdates.set(runId, { ...existing, ...updates });

    // Schedule flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flushUpdates(), 100);
    }
  }

  /**
   * Get all runs, sorted by creation time (newest first)
   */
  getAllRuns(options?: {
    source?: DbRunInfo['source'];
    conversationId?: string;
    limit?: number;
  }): RunInfo[] {
    // Flush pending updates to ensure consistency in the list
    if (this.pendingUpdates.size > 0) {
      this.flushUpdates();
    }

    const effectiveOptions = {
      limit: this.maxRuns,
      ...options,
    };

    const cacheKey = JSON.stringify(effectiveOptions);
    const cached = this.listCache.get(cacheKey);
    if (cached) return cached;

    const dbRuns = dbGetAllRuns(effectiveOptions);
    const runs = dbRuns.map(dbRunToLegacy);
    this.listCache.set(cacheKey, runs);
    return runs;
  }

  /**
   * Delete a run
   */
  deleteRun(runId: string): boolean {
    // Flush updates before deleting
    if (this.pendingUpdates.has(runId)) {
      this.flushUpdates();
    }

    const result = dbDeleteRun(runId);
    if (result) {
      this.runCache.delete(runId);
      this.listCache.clear();
    }
    return result;
  }
}
