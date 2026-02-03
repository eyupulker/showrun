import type { Page } from 'playwright';
import type {
  DslStep,
  NavigateStep,
  ExtractTitleStep,
  ExtractTextStep,
  ExtractAttributeStep,
  SleepStep,
  WaitForStep,
  ClickStep,
  FillStep,
  AssertStep,
  SetVarStep,
  NetworkFindStep,
  NetworkReplayStep,
  NetworkExtractStep,
  VariableContext,
} from './types.js';
import type { NetworkCaptureApi, NetworkFindWhere, NetworkReplayOverrides } from '../networkCapture.js';
import { resolveTemplate } from './templating.js';
import { resolveTargetWithFallback, selectorToTarget } from './target.js';
import type { AuthFailureMonitor } from '../authResilience.js';
import { JSONPath } from 'jsonpath-plus';

/**
 * Step execution context
 */
export interface StepContext {
  page: Page;
  collectibles: Record<string, unknown>;
  vars: Record<string, unknown>;
  inputs: Record<string, unknown>;
  /** Required for network_find and network_replay */
  networkCapture?: NetworkCaptureApi;
  /** Optional auth failure monitor for detecting auth failures in network_replay */
  authMonitor?: AuthFailureMonitor;
  /** Current step ID for auth failure tracking */
  currentStepId?: string;
}

/**
 * Executes a navigate step
 */
async function executeNavigate(
  ctx: StepContext,
  step: NavigateStep
): Promise<void> {
  await ctx.page.goto(step.params.url, {
    waitUntil: step.params.waitUntil ?? 'networkidle',
  });
}

/**
 * Executes an extract_title step
 */
async function executeExtractTitle(
  ctx: StepContext,
  step: ExtractTitleStep
): Promise<void> {
  const title = await ctx.page.title();
  ctx.collectibles[step.params.out] = title;
}

/**
 * Executes an extract_text step
 */
async function executeExtractText(
  ctx: StepContext,
  step: ExtractTextStep
): Promise<void> {
  // Support both legacy selector and new target
  const targetOrAnyOf = step.params.target ?? (step.params.selector ? selectorToTarget(step.params.selector) : null);
  
  if (!targetOrAnyOf) {
    throw new Error('ExtractText step must have either "target" or "selector"');
  }

  // Resolve target with fallback and scope
  const { locator, matchedTarget, matchedCount } = await resolveTargetWithFallback(
    ctx.page,
    targetOrAnyOf,
    step.params.scope
  );

  // Log matched target for diagnostics (if hint provided, include it)
  if (step.params.hint) {
    console.log(`[ExtractText:${step.id}] Matched target: ${JSON.stringify(matchedTarget)}, count: ${matchedCount}, hint: ${step.params.hint}`);
  }

  const count = matchedCount;

  if (count === 0) {
    // No elements found, use default if provided
    ctx.collectibles[step.params.out] = step.params.default ?? '';
    return;
  }

  if (step.params.first ?? true) {
    // Get first element only
    const text = await locator.first().textContent();
    ctx.collectibles[step.params.out] = step.params.trim ?? true ? text?.trim() ?? '' : text ?? '';
  } else {
    // Get all elements
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await locator.nth(i).textContent();
      const processed = step.params.trim ?? true ? text?.trim() ?? '' : text ?? '';
      texts.push(processed);
    }
    ctx.collectibles[step.params.out] = texts;
  }
}

/**
 * Executes a sleep step
 */
async function executeSleep(
  ctx: StepContext,
  step: SleepStep
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, step.params.durationMs));
}

/**
 * Executes a wait_for step
 */
async function executeWaitFor(
  ctx: StepContext,
  step: WaitForStep
): Promise<void> {
  const timeout = step.timeoutMs ?? step.params.timeoutMs ?? 30000;

  // Support both legacy selector and new target
  const targetOrAnyOf = step.params.target ?? (step.params.selector ? selectorToTarget(step.params.selector) : null);

  if (targetOrAnyOf) {
    const { locator, matchedTarget, matchedCount } = await resolveTargetWithFallback(
      ctx.page,
      targetOrAnyOf,
      step.params.scope
    );

    // Log matched target for diagnostics
    if (step.params.hint) {
      console.log(`[WaitFor:${step.id}] Matched target: ${JSON.stringify(matchedTarget)}, count: ${matchedCount}, hint: ${step.params.hint}`);
    }

    if (step.params.visible ?? true) {
      await locator.first().waitFor({ state: 'visible', timeout });
    } else {
      await locator.first().waitFor({ state: 'attached', timeout });
    }
  } else if (step.params.url) {
    if (typeof step.params.url === 'string') {
      await ctx.page.waitForURL(step.params.url, { timeout });
    } else {
      // For pattern matching, use a function matcher
      const urlPattern = step.params.url.pattern;
      const exactMatch = step.params.url.exact ?? false;
      await ctx.page.waitForURL(
        (url) => {
          if (exactMatch) {
            return url.href === urlPattern;
          }
          return url.href.includes(urlPattern);
        },
        { timeout }
      );
    }
  } else if (step.params.loadState) {
    await ctx.page.waitForLoadState(step.params.loadState, { timeout });
  } else {
    throw new Error('wait_for step must specify selector, url, or loadState');
  }
}

/**
 * Executes a click step
 */
async function executeClick(
  ctx: StepContext,
  step: ClickStep
): Promise<void> {
  // Support both legacy selector and new target
  const targetOrAnyOf = step.params.target ?? (step.params.selector ? selectorToTarget(step.params.selector) : null);
  
  if (!targetOrAnyOf) {
    throw new Error('Click step must have either "target" or "selector"');
  }

  // Resolve target with fallback and scope
  const { locator, matchedTarget, matchedCount } = await resolveTargetWithFallback(
    ctx.page,
    targetOrAnyOf,
    step.params.scope
  );

  // Log matched target for diagnostics
  if (step.params.hint) {
    console.log(`[Click:${step.id}] Matched target: ${JSON.stringify(matchedTarget)}, count: ${matchedCount}, hint: ${step.params.hint}`);
  }

  const target = step.params.first ?? true ? locator.first() : locator;

  if (step.params.waitForVisible ?? true) {
    await target.waitFor({ state: 'visible' });
  }

  await target.click();
}

/**
 * Executes a fill step
 */
async function executeFill(
  ctx: StepContext,
  step: FillStep
): Promise<void> {
  // Support both legacy selector and new target
  const targetOrAnyOf = step.params.target ?? (step.params.selector ? selectorToTarget(step.params.selector) : null);
  
  if (!targetOrAnyOf) {
    throw new Error('Fill step must have either "target" or "selector"');
  }

  // Resolve target with fallback and scope
  const { locator, matchedTarget, matchedCount } = await resolveTargetWithFallback(
    ctx.page,
    targetOrAnyOf,
    step.params.scope
  );

  // Log matched target for diagnostics
  if (step.params.hint) {
    console.log(`[Fill:${step.id}] Matched target: ${JSON.stringify(matchedTarget)}, count: ${matchedCount}, hint: ${step.params.hint}`);
  }

  const target = step.params.first ?? true ? locator.first() : locator;

  await target.waitFor({ state: 'visible' });

  if (step.params.clear ?? true) {
    await target.fill(step.params.value);
  } else {
    await target.type(step.params.value);
  }
}

/**
 * Executes an extract_attribute step
 */
async function executeExtractAttribute(
  ctx: StepContext,
  step: ExtractAttributeStep
): Promise<void> {
  // Support both legacy selector and new target
  const targetOrAnyOf = step.params.target ?? (step.params.selector ? selectorToTarget(step.params.selector) : null);
  
  if (!targetOrAnyOf) {
    throw new Error('ExtractAttribute step must have either "target" or "selector"');
  }

  // Resolve target with fallback and scope
  const { locator, matchedTarget, matchedCount } = await resolveTargetWithFallback(
    ctx.page,
    targetOrAnyOf,
    step.params.scope
  );

  // Log matched target for diagnostics
  if (step.params.hint) {
    console.log(`[ExtractAttribute:${step.id}] Matched target: ${JSON.stringify(matchedTarget)}, count: ${matchedCount}, hint: ${step.params.hint}`);
  }

  const count = matchedCount;

  if (count === 0) {
    ctx.collectibles[step.params.out] = step.params.default ?? '';
    return;
  }

  if (step.params.first ?? true) {
    const value = await locator.first().getAttribute(step.params.attribute);
    ctx.collectibles[step.params.out] = value ?? step.params.default ?? '';
  } else {
    const values: (string | null)[] = [];
    for (let i = 0; i < count; i++) {
      const value = await locator.nth(i).getAttribute(step.params.attribute);
      values.push(value);
    }
    ctx.collectibles[step.params.out] = values;
  }
}

/**
 * Executes an assert step
 */
async function executeAssert(
  ctx: StepContext,
  step: AssertStep
): Promise<void> {
  const errors: string[] = [];

  // Support both legacy selector and new target
  const targetOrAnyOf = step.params.target ?? (step.params.selector ? selectorToTarget(step.params.selector) : null);

  if (targetOrAnyOf) {
    const { locator, matchedTarget, matchedCount } = await resolveTargetWithFallback(
      ctx.page,
      targetOrAnyOf,
      step.params.scope
    );

    // Log matched target for diagnostics
    if (step.params.hint) {
      console.log(`[Assert:${step.id}] Matched target: ${JSON.stringify(matchedTarget)}, count: ${matchedCount}, hint: ${step.params.hint}`);
    }

    if (matchedCount === 0) {
      errors.push(`Element not found: ${JSON.stringify(matchedTarget)}`);
    } else if (step.params.visible !== undefined) {
      const isVisible = await locator.first().isVisible();
      if (step.params.visible && !isVisible) {
        errors.push(`Element not visible: ${JSON.stringify(matchedTarget)}`);
      } else if (!step.params.visible && isVisible) {
        errors.push(`Element should not be visible: ${JSON.stringify(matchedTarget)}`);
      }
    }

    if (step.params.textIncludes) {
      const text = await locator.first().textContent();
      if (!text || !text.includes(step.params.textIncludes)) {
        errors.push(
          `Element text does not include "${step.params.textIncludes}": ${JSON.stringify(matchedTarget)}`
        );
      }
    }
  }

  if (step.params.urlIncludes) {
    const url = ctx.page.url();
    if (!url.includes(step.params.urlIncludes)) {
      errors.push(`URL does not include "${step.params.urlIncludes}": ${url}`);
    }
  }

  if (errors.length > 0) {
    const message = step.params.message || errors.join('; ');
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Executes a set_var step
 * Note: Value may contain templates that need to be resolved
 */
async function executeSetVar(
  ctx: StepContext,
  step: SetVarStep
): Promise<void> {
  // If value is a string, it might contain templates - resolve them
  let resolvedValue: string | number | boolean = step.params.value;
  
  if (typeof resolvedValue === 'string') {
    // Resolve templates in the value
    const varContext: VariableContext = {
      inputs: ctx.inputs,
      vars: ctx.vars,
    };
    resolvedValue = resolveTemplate(resolvedValue, varContext);
  }
  
  ctx.vars[step.params.name] = resolvedValue;
}

/**
 * Extract value from object using path expression.
 * Supports JSONPath syntax (starting with $) or simple dot notation.
 * Examples:
 *   - "$.results[0].hits[*]" - JSONPath with array access and wildcards
 *   - "$.name" - JSONPath for simple field
 *   - "data.items" - Simple dot notation (legacy)
 */
function getByPath(obj: unknown, path: string): unknown {
  const trimmed = path.trim();

  // Use JSONPath for paths starting with $ or containing brackets
  if (trimmed.startsWith('$') || trimmed.includes('[')) {
    const results = JSONPath({ path: trimmed, json: obj as object, wrap: false });
    return results;
  }

  // Simple dot-path fallback for legacy paths
  const parts = trimmed.split('.');
  let current: unknown = obj;
  for (const key of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes a network_find step. If waitForMs is set and no match is found initially, polls the buffer until a match appears or timeout.
 */
async function executeNetworkFind(
  ctx: StepContext,
  step: NetworkFindStep
): Promise<void> {
  if (!ctx.networkCapture) {
    throw new Error(
      'network_find requires an active browser session with network capture. Run the flow in a context that has network capture enabled.'
    );
  }
  const where: NetworkFindWhere = step.params.where ?? {};
  const pick = step.params.pick ?? 'last';
  const waitForMs = step.params.waitForMs ?? 0;
  const pollIntervalMs = Math.min(Math.max(step.params.pollIntervalMs ?? 400, 100), 5000);

  // When matching on response body, the capture's response handler is async (await response.body()).
  // Give in-flight handlers time to complete before the first lookup so entries have responseBodyText.
  if (where.responseContains != null) {
    await sleepMs(Math.min(pollIntervalMs * 4, 2000));
  }

  let requestId: string | null = ctx.networkCapture.getRequestIdByIndex(where, pick);
  if (requestId == null && waitForMs > 0) {
    const deadline = Date.now() + waitForMs;
    while (Date.now() < deadline) {
      await sleepMs(pollIntervalMs);
      requestId = ctx.networkCapture!.getRequestIdByIndex(where, pick);
      if (requestId != null) break;
    }
  }
  if (requestId == null) {
    const msg = `network_find: no request matched (where: ${JSON.stringify(where)}, pick: ${pick})${waitForMs > 0 ? ` within ${waitForMs}ms` : ''}. Ensure the request is triggered before this step (e.g. by navigation or a prior interaction), or increase waitForMs.`;
    console.warn(`[${step.id}] ${msg}`);
    throw new Error(msg);
  }
  ctx.vars[step.params.saveAs] = requestId;
}

/**
 * Executes a network_replay step
 */
async function executeNetworkReplay(
  ctx: StepContext,
  step: NetworkReplayStep
): Promise<void> {
  if (!ctx.networkCapture) {
    throw new Error(
      'network_replay requires an active browser session with network capture. Run the flow in a context that has network capture enabled.'
    );
  }
  const requestId = step.params.requestId;
  const overrides: NetworkReplayOverrides | undefined = step.params.overrides
    ? {
        url: step.params.overrides.url,
        setQuery: step.params.overrides.setQuery,
        setHeaders: step.params.overrides.setHeaders,
        body: step.params.overrides.body,
        urlReplace: step.params.overrides.urlReplace,
        bodyReplace: step.params.overrides.bodyReplace,
      }
    : undefined;

  let result: { status: number; contentType?: string; body: string; bodySize: number };
  try {
    result = await ctx.networkCapture.replay(requestId, overrides);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Request not found')) {
      throw new Error(
        `${msg} The request may not have been captured yet. Ensure a network_find step runs before network_replay and triggers the request (e.g. by navigating or interacting first). Use waitForMs in network_find to wait for the request to appear (e.g. waitForMs: 10000).`
      );
    }
    throw err;
  }

  // Check for auth failure in network_replay response
  if (ctx.authMonitor?.isEnabled() && ctx.currentStepId) {
    // Get the original request URL from the captured entry
    const entry = ctx.networkCapture.get(requestId);
    const url = entry?.url || '';
    if (ctx.authMonitor.isAuthFailure(url, result.status)) {
      ctx.authMonitor.recordFailure({
        url,
        status: result.status,
        stepId: ctx.currentStepId,
      });
    }
  }

  if (step.params.saveAs) {
    ctx.vars[step.params.saveAs] = {
      status: result.status,
      contentType: result.contentType,
      body: result.body,
      bodySize: result.bodySize,
    };
  }

  let outValue: unknown;
  if (step.params.response.as === 'json') {
    try {
      outValue = JSON.parse(result.body) as unknown;
    } catch {
      throw new Error(`network_replay: response body is not valid JSON (status ${result.status})`);
    }
    if (step.params.response.jsonPath) {
      outValue = getByPath(outValue, step.params.response.jsonPath);
    }
  } else {
    outValue = step.params.response.jsonPath
      ? getByPath(JSON.parse(result.body) as unknown, step.params.response.jsonPath)
      : result.body;
    if (typeof outValue === 'object' && outValue !== null) {
      outValue = JSON.stringify(outValue);
    }
  }
  ctx.collectibles[step.params.out] = outValue;
}

/**
 * Executes a network_extract step (from var set by network_replay saveAs or similar)
 */
async function executeNetworkExtract(
  ctx: StepContext,
  step: NetworkExtractStep
): Promise<void> {
  // Check vars first, then collectibles (network_replay uses 'out' for collectibles, 'saveAs' for vars)
  const raw = ctx.vars[step.params.fromVar] ?? ctx.collectibles[step.params.fromVar];
  if (raw === undefined) {
    throw new Error(`network_extract: var "${step.params.fromVar}" is not set (checked vars and collectibles)`);
  }
  // Replay saveAs stores { body, status, contentType, bodySize }; support that or raw string
  const bodyStr =
    raw && typeof raw === 'object' && 'body' in raw && typeof (raw as { body: unknown }).body === 'string'
      ? (raw as { body: string }).body
      : typeof raw === 'string'
        ? raw
        : JSON.stringify(raw);

  let value: unknown;
  if (step.params.as === 'json') {
    const parsed = JSON.parse(bodyStr) as unknown;
    value = step.params.jsonPath ? getByPath(parsed, step.params.jsonPath) : parsed;

    // Apply transform if provided (maps each item in array using jsonPath expressions)
    if (step.params.transform && Array.isArray(value)) {
      const transformMap = step.params.transform;
      value = value.map((item: unknown) => {
        const transformed: Record<string, unknown> = {};
        for (const [key, path] of Object.entries(transformMap)) {
          transformed[key] = getByPath(item, path);
        }
        return transformed;
      });
    } else if (step.params.transform && !Array.isArray(value) && typeof value === 'object' && value !== null) {
      // Single object transform
      const transformMap = step.params.transform;
      const transformed: Record<string, unknown> = {};
      for (const [key, path] of Object.entries(transformMap)) {
        transformed[key] = getByPath(value, path);
      }
      value = transformed;
    }
  } else {
    value = step.params.jsonPath
      ? getByPath(JSON.parse(bodyStr) as unknown, step.params.jsonPath)
      : bodyStr;
    if (typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    }
  }
  ctx.collectibles[step.params.out] = value;
}

/**
 * Executes a single DSL step
 */
export async function executeStep(
  ctx: StepContext,
  step: DslStep
): Promise<void> {
  switch (step.type) {
    case 'navigate':
      await executeNavigate(ctx, step);
      break;
    case 'extract_title':
      await executeExtractTitle(ctx, step);
      break;
    case 'extract_text':
      await executeExtractText(ctx, step);
      break;
    case 'extract_attribute':
      await executeExtractAttribute(ctx, step);
      break;
    case 'sleep':
      await executeSleep(ctx, step);
      break;
    case 'wait_for':
      await executeWaitFor(ctx, step);
      break;
    case 'click':
      await executeClick(ctx, step);
      break;
    case 'fill':
      await executeFill(ctx, step);
      break;
    case 'assert':
      await executeAssert(ctx, step);
      break;
    case 'set_var':
      await executeSetVar(ctx, step);
      break;
    case 'network_find':
      await executeNetworkFind(ctx, step);
      break;
    case 'network_replay':
      await executeNetworkReplay(ctx, step);
      break;
    case 'network_extract':
      await executeNetworkExtract(ctx, step);
      break;
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = step;
      throw new Error(`Unknown step type: ${(_exhaustive as DslStep).type}`);
  }
}
