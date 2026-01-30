/**
 * Manages run state and history
 */
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
}

export class RunManager {
  private runs: Map<string, RunInfo> = new Map();
  private maxRuns = 100; // Keep last 100 runs

  /**
   * Add a new run
   */
  addRun(run: RunInfo): void {
    this.runs.set(run.runId, run);

    // Trim old runs if we exceed max
    if (this.runs.size > this.maxRuns) {
      const sorted = Array.from(this.runs.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      );
      const toRemove = sorted.slice(this.maxRuns);
      for (const runToRemove of toRemove) {
        this.runs.delete(runToRemove.runId);
      }
    }
  }

  /**
   * Get a run by ID
   */
  getRun(runId: string): RunInfo | undefined {
    return this.runs.get(runId);
  }

  /**
   * Update a run
   */
  updateRun(runId: string, updates: Partial<RunInfo>): void {
    const run = this.runs.get(runId);
    if (run) {
      Object.assign(run, updates);
    }
  }

  /**
   * Get all runs, sorted by creation time (newest first)
   */
  getAllRuns(): RunInfo[] {
    return Array.from(this.runs.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  }
}
