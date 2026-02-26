/**
 * HTTP-only execution engine for request snapshots.
 *
 * When every `network_replay` step in a flow has a valid snapshot and no
 * DOM extraction steps exist, the flow can be executed purely via HTTP
 * requests — no browser needed.
 */

import type { DslStep } from './dsl/types.js';
import {
  type RequestSnapshot,
  type SnapshotFile,
  isSnapshotStale,
  validateResponse,
  applyOverrides,
  type ValidationResult,
} from './requestSnapshot.js';
import type { ResolvedProxy } from './proxy/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default timeout for HTTP replay requests (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpReplayResult {
  status: number;
  contentType?: string;
  body: string;
  bodySize: number;
}

// ---------------------------------------------------------------------------
// HTTP-only compatibility check
// ---------------------------------------------------------------------------

/** Step types that require DOM access for data extraction (force browser mode). */
const DOM_EXTRACTION_STEPS = new Set(['extract_text', 'extract_title', 'extract_attribute', 'dom_scrape']);

/**
 * Step types that are silently skipped in HTTP mode.
 * Must match HTTP_MODE_SKIP_STEPS in stepHandlers.ts.
 */
const HTTP_SKIPPED_STEPS = new Set([
  'navigate', 'click', 'fill', 'select_option', 'press_key',
  'upload_file', 'wait_for', 'assert', 'frame', 'new_tab',
  'switch_tab', 'network_find', 'dom_scrape',
]);

/** Check if a value contains Nunjucks template expressions. */
function containsTemplate(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('{{');
  if (Array.isArray(value)) return value.some(containsTemplate);
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsTemplate);
  }
  return false;
}

/**
 * Check whether a flow can run in HTTP-only mode.
 *
 * Requirements:
 * 1. Every `network_replay` step has a corresponding, non-stale snapshot.
 * 2. No DOM extraction steps exist in the flow.
 * 3. No skipped steps contain dynamic templates — templates in skipped steps
 *    would never be evaluated, so the snapshot replays stale data.
 */
export function isFlowHttpCompatible(
  steps: DslStep[],
  snapshots: SnapshotFile | null,
): boolean {
  if (!snapshots) return false;

  for (const step of steps) {
    // DOM extraction steps force browser mode
    if (DOM_EXTRACTION_STEPS.has(step.type)) {
      return false;
    }

    // Steps skipped in HTTP mode must not contain templates — those templates
    // affect what data the API returns but would never be evaluated, causing
    // the snapshot to replay stale/wrong data regardless of input values.
    if (HTTP_SKIPPED_STEPS.has(step.type) && containsTemplate(step.params)) {
      return false;
    }
  }

  // Check that every network_replay step has a valid snapshot
  const replaySteps = steps.filter((s) => s.type === 'network_replay');
  if (replaySteps.length === 0) return false; // No point in HTTP mode without replay steps

  for (const step of replaySteps) {
    const snapshot = snapshots.snapshots[step.id];
    if (!snapshot) return false;
    if (isSnapshotStale(snapshot)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// HTTP replay
// ---------------------------------------------------------------------------

/**
 * Make a direct HTTP request using snapshot data + applied overrides.
 * Uses Node's native `fetch()` with an AbortController timeout.
 */
export async function replayFromSnapshot(
  snapshot: RequestSnapshot,
  inputs: Record<string, unknown>,
  vars: Record<string, unknown>,
  options?: { secrets?: Record<string, string>; timeoutMs?: number; proxy?: ResolvedProxy },
): Promise<HttpReplayResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { url, method, headers, body } = applyOverrides(snapshot, inputs, vars, options?.secrets);

  // Remove content-length — the snapshot captures the original request's
  // content-length, but overrides may change the body size. Node's fetch()
  // sets the correct content-length automatically from the actual body.
  delete headers['content-length'];
  delete headers['Content-Length'];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = body;
  }

  // When proxy is provided, create a ProxyAgent dispatcher for undici-backed fetch.
  // undici is bundled with Node but may not have separate type declarations.
  if (options?.proxy) {
    try {
      // @ts-expect-error undici types may not be installed; runtime import is fine
      const undiciModule = await import('undici');
      const ProxyAgentClass = (undiciModule as any).ProxyAgent;
      if (ProxyAgentClass) {
        const proxyUrl = options.proxy.server.replace(
          '://',
          `://${encodeURIComponent(options.proxy.username)}:${encodeURIComponent(options.proxy.password)}@`,
        );
        (fetchOptions as any).dispatcher = new ProxyAgentClass(proxyUrl);
      }
    } catch {
      console.warn('[httpReplay] Failed to load undici ProxyAgent, making direct request');
    }
  }

  try {
    const response = await fetch(url, fetchOptions);
    const responseBody = await response.text();
    const contentType = response.headers.get('content-type') ?? undefined;

    return {
      status: response.status,
      contentType,
      body: responseBody,
      bodySize: Buffer.byteLength(responseBody, 'utf8'),
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`HTTP replay timed out after ${timeoutMs}ms for ${method} ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Replay a snapshot and validate the response.
 * Returns the result along with validation info.
 */
export async function replayAndValidate(
  snapshot: RequestSnapshot,
  inputs: Record<string, unknown>,
  vars: Record<string, unknown>,
  options?: { secrets?: Record<string, string>; timeoutMs?: number; proxy?: ResolvedProxy },
): Promise<{ result: HttpReplayResult; validation: ValidationResult }> {
  const result = await replayFromSnapshot(snapshot, inputs, vars, options);
  const validation = validateResponse(snapshot, result);
  return { result, validation };
}
