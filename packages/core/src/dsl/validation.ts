import type { DslStep, Target, TargetOrAnyOf } from './types.js';

/**
 * Validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a Target object
 */
function validateTarget(target: unknown): target is Target {
  if (!target || typeof target !== 'object') {
    throw new ValidationError('Target must be an object');
  }

  const t = target as Record<string, unknown>;

  if (typeof t.kind !== 'string') {
    throw new ValidationError('Target must have a string "kind"');
  }

  switch (t.kind) {
    case 'css':
      if (typeof t.selector !== 'string' || !t.selector) {
        throw new ValidationError('CSS target must have a non-empty string "selector"');
      }
      break;

    case 'text':
      if (typeof t.text !== 'string' || !t.text) {
        throw new ValidationError('Text target must have a non-empty string "text"');
      }
      if (t.exact !== undefined && typeof t.exact !== 'boolean') {
        throw new ValidationError('Text target "exact" must be a boolean');
      }
      break;

    case 'role':
      const validRoles = [
        'button', 'checkbox', 'combobox', 'dialog', 'gridcell', 'link', 'listbox',
        'menuitem', 'option', 'radio', 'searchbox', 'slider', 'switch', 'tab',
        'tabpanel', 'textbox', 'treeitem', 'article', 'banner', 'complementary',
        'contentinfo', 'form', 'main', 'navigation', 'region', 'search', 'alert',
        'log', 'marquee', 'status', 'timer'
      ];
      if (!validRoles.includes(t.role as string)) {
        throw new ValidationError(`Role target must have a valid role: ${validRoles.join(', ')}`);
      }
      if (t.name !== undefined && typeof t.name !== 'string') {
        throw new ValidationError('Role target "name" must be a string');
      }
      if (t.exact !== undefined && typeof t.exact !== 'boolean') {
        throw new ValidationError('Role target "exact" must be a boolean');
      }
      break;

    case 'label':
      if (typeof t.text !== 'string' || !t.text) {
        throw new ValidationError('Label target must have a non-empty string "text"');
      }
      if (t.exact !== undefined && typeof t.exact !== 'boolean') {
        throw new ValidationError('Label target "exact" must be a boolean');
      }
      break;

    case 'placeholder':
      if (typeof t.text !== 'string' || !t.text) {
        throw new ValidationError('Placeholder target must have a non-empty string "text"');
      }
      if (t.exact !== undefined && typeof t.exact !== 'boolean') {
        throw new ValidationError('Placeholder target "exact" must be a boolean');
      }
      break;

    case 'altText':
      if (typeof t.text !== 'string' || !t.text) {
        throw new ValidationError('AltText target must have a non-empty string "text"');
      }
      if (t.exact !== undefined && typeof t.exact !== 'boolean') {
        throw new ValidationError('AltText target "exact" must be a boolean');
      }
      break;

    case 'testId':
      if (typeof t.id !== 'string' || !t.id) {
        throw new ValidationError('TestId target must have a non-empty string "id"');
      }
      break;

    default:
      throw new ValidationError(`Unknown target kind: ${t.kind}`);
  }

  return true;
}

/**
 * Validates TargetOrAnyOf (single target or anyOf array)
 */
function validateTargetOrAnyOf(targetOrAnyOf: unknown): void {
  if (!targetOrAnyOf) {
    return; // Optional, so empty is OK
  }

  if (typeof targetOrAnyOf === 'object' && 'anyOf' in targetOrAnyOf) {
    const anyOf = (targetOrAnyOf as { anyOf: unknown }).anyOf;
    if (!Array.isArray(anyOf) || anyOf.length === 0) {
      throw new ValidationError('Target "anyOf" must be a non-empty array');
    }
    for (const target of anyOf) {
      validateTarget(target);
    }
  } else {
    validateTarget(targetOrAnyOf);
  }
}

/**
 * Validates a single step
 */
function validateStep(step: unknown): step is DslStep {
  if (!step || typeof step !== 'object') {
    throw new ValidationError('Step must be an object');
  }

  const s = step as Record<string, unknown>;

  // Check required fields
  if (typeof s.id !== 'string' || !s.id) {
    throw new ValidationError('Step must have a non-empty string "id"');
  }

  if (typeof s.type !== 'string' || !s.type) {
    throw new ValidationError('Step must have a non-empty string "type"');
  }

  // Validate optional common fields
  if (s.label !== undefined && typeof s.label !== 'string') {
    throw new ValidationError('Step "label" must be a string');
  }
  if (s.timeoutMs !== undefined && (typeof s.timeoutMs !== 'number' || s.timeoutMs < 0)) {
    throw new ValidationError('Step "timeoutMs" must be a non-negative number');
  }
  if (s.optional !== undefined && typeof s.optional !== 'boolean') {
    throw new ValidationError('Step "optional" must be a boolean');
  }
  if (s.onError !== undefined) {
    if (s.onError !== 'stop' && s.onError !== 'continue') {
      throw new ValidationError('Step "onError" must be "stop" or "continue"');
    }
  }

  if (!s.params || typeof s.params !== 'object') {
    throw new ValidationError('Step must have a "params" object');
  }

  const params = s.params as Record<string, unknown>;

  // Validate step type and params
  switch (s.type) {
    case 'navigate':
      if (typeof params.url !== 'string' || !params.url) {
        throw new ValidationError('Navigate step must have a non-empty string "url" in params');
      }
      if (params.waitUntil !== undefined) {
        const validWaitUntil = ['load', 'domcontentloaded', 'networkidle', 'commit'];
        if (!validWaitUntil.includes(params.waitUntil as string)) {
          throw new ValidationError(
            `Navigate step "waitUntil" must be one of: ${validWaitUntil.join(', ')}`
          );
        }
      }
      break;

    case 'extract_title':
      if (typeof params.out !== 'string' || !params.out) {
        throw new ValidationError('ExtractTitle step must have a non-empty string "out" in params');
      }
      break;

    case 'extract_text':
      // Must have either selector (legacy) or target (new)
      if (!params.selector && !params.target) {
        throw new ValidationError('ExtractText step must have either "selector" or "target" in params');
      }
      if (params.selector !== undefined && typeof params.selector !== 'string') {
        throw new ValidationError('ExtractText step "selector" must be a string');
      }
      if (params.target !== undefined) {
        validateTargetOrAnyOf(params.target);
      }
      if (typeof params.out !== 'string' || !params.out) {
        throw new ValidationError('ExtractText step must have a non-empty string "out" in params');
      }
      if (params.first !== undefined && typeof params.first !== 'boolean') {
        throw new ValidationError('ExtractText step "first" must be a boolean');
      }
      if (params.trim !== undefined && typeof params.trim !== 'boolean') {
        throw new ValidationError('ExtractText step "trim" must be a boolean');
      }
      if (params.default !== undefined && typeof params.default !== 'string') {
        throw new ValidationError('ExtractText step "default" must be a string');
      }
      if (params.hint !== undefined && typeof params.hint !== 'string') {
        throw new ValidationError('ExtractText step "hint" must be a string');
      }
      if (params.scope !== undefined) {
        validateTarget(params.scope);
      }
      if (params.near !== undefined && params.near !== null) {
        const near = params.near as Record<string, unknown>;
        if (typeof near !== 'object' || near.kind !== 'text') {
          throw new ValidationError('ExtractText step "near" must be an object with kind: "text"');
        }
        if (typeof near.text !== 'string') {
          throw new ValidationError('ExtractText step "near.text" must be a string');
        }
        if (near.exact !== undefined && typeof near.exact !== 'boolean') {
          throw new ValidationError('ExtractText step "near.exact" must be a boolean');
        }
      }
      break;

    case 'sleep':
      if (typeof params.durationMs !== 'number' || params.durationMs < 0) {
        throw new ValidationError(
          'Sleep step must have a non-negative number "durationMs" in params'
        );
      }
      break;

    case 'wait_for':
      if (!params.selector && !params.target && !params.url && !params.loadState) {
        throw new ValidationError(
          'WaitFor step must have one of: selector, target, url, or loadState'
        );
      }
      if (params.selector !== undefined && typeof params.selector !== 'string') {
        throw new ValidationError('WaitFor step "selector" must be a string');
      }
      if (params.target !== undefined) {
        validateTargetOrAnyOf(params.target);
      }
      if (params.hint !== undefined && typeof params.hint !== 'string') {
        throw new ValidationError('WaitFor step "hint" must be a string');
      }
      if (params.scope !== undefined) {
        validateTarget(params.scope);
      }
      if (params.near !== undefined && params.near !== null) {
        const near = params.near as Record<string, unknown>;
        if (typeof near !== 'object' || near.kind !== 'text') {
          throw new ValidationError('WaitFor step "near" must be an object with kind: "text"');
        }
        if (typeof near.text !== 'string') {
          throw new ValidationError('WaitFor step "near.text" must be a string');
        }
        if (near.exact !== undefined && typeof near.exact !== 'boolean') {
          throw new ValidationError('WaitFor step "near.exact" must be a boolean');
        }
      }
      if (params.visible !== undefined && typeof params.visible !== 'boolean') {
        throw new ValidationError('WaitFor step "visible" must be a boolean');
      }
      if (params.url !== undefined && params.url !== null) {
        if (typeof params.url === 'string') {
          // Valid string URL
        } else if (typeof params.url === 'object') {
          const urlObj = params.url as Record<string, unknown>;
          if (typeof urlObj.pattern !== 'string') {
            throw new ValidationError('WaitFor step "url" object must have a string "pattern"');
          }
          if (urlObj.exact !== undefined && typeof urlObj.exact !== 'boolean') {
            throw new ValidationError('WaitFor step "url" object "exact" must be a boolean');
          }
        } else {
          throw new ValidationError('WaitFor step "url" must be a string or object with pattern');
        }
      }
      if (params.loadState !== undefined) {
        const validLoadStates = ['load', 'domcontentloaded', 'networkidle'];
        if (!validLoadStates.includes(params.loadState as string)) {
          throw new ValidationError(
            `WaitFor step "loadState" must be one of: ${validLoadStates.join(', ')}`
          );
        }
      }
      if (params.timeoutMs !== undefined && (typeof params.timeoutMs !== 'number' || params.timeoutMs < 0)) {
        throw new ValidationError('WaitFor step "timeoutMs" must be a non-negative number');
      }
      break;

    case 'click':
      // Must have either selector (legacy) or target (new)
      if (!params.selector && !params.target) {
        throw new ValidationError('Click step must have either "selector" or "target" in params');
      }
      if (params.selector !== undefined && typeof params.selector !== 'string') {
        throw new ValidationError('Click step "selector" must be a string');
      }
      if (params.target !== undefined) {
        validateTargetOrAnyOf(params.target);
      }
      if (params.first !== undefined && typeof params.first !== 'boolean') {
        throw new ValidationError('Click step "first" must be a boolean');
      }
      if (params.waitForVisible !== undefined && typeof params.waitForVisible !== 'boolean') {
        throw new ValidationError('Click step "waitForVisible" must be a boolean');
      }
      if (params.hint !== undefined && typeof params.hint !== 'string') {
        throw new ValidationError('Click step "hint" must be a string');
      }
      if (params.scope !== undefined) {
        validateTarget(params.scope);
      }
      if (params.near !== undefined && params.near !== null) {
        const near = params.near as Record<string, unknown>;
        if (typeof near !== 'object' || near.kind !== 'text') {
          throw new ValidationError('Click step "near" must be an object with kind: "text"');
        }
        if (typeof near.text !== 'string') {
          throw new ValidationError('Click step "near.text" must be a string');
        }
        if (near.exact !== undefined && typeof near.exact !== 'boolean') {
          throw new ValidationError('Click step "near.exact" must be a boolean');
        }
      }
      break;

    case 'fill':
      // Must have either selector (legacy) or target (new)
      if (!params.selector && !params.target) {
        throw new ValidationError('Fill step must have either "selector" or "target" in params');
      }
      if (params.selector !== undefined && typeof params.selector !== 'string') {
        throw new ValidationError('Fill step "selector" must be a string');
      }
      if (params.target !== undefined) {
        validateTargetOrAnyOf(params.target);
      }
      if (typeof params.value !== 'string') {
        throw new ValidationError('Fill step must have a string "value" in params');
      }
      if (params.first !== undefined && typeof params.first !== 'boolean') {
        throw new ValidationError('Fill step "first" must be a boolean');
      }
      if (params.clear !== undefined && typeof params.clear !== 'boolean') {
        throw new ValidationError('Fill step "clear" must be a boolean');
      }
      if (params.hint !== undefined && typeof params.hint !== 'string') {
        throw new ValidationError('Fill step "hint" must be a string');
      }
      if (params.scope !== undefined) {
        validateTarget(params.scope);
      }
      if (params.near !== undefined && params.near !== null) {
        const near = params.near as Record<string, unknown>;
        if (typeof near !== 'object' || near.kind !== 'text') {
          throw new ValidationError('Fill step "near" must be an object with kind: "text"');
        }
        if (typeof near.text !== 'string') {
          throw new ValidationError('Fill step "near.text" must be a string');
        }
        if (near.exact !== undefined && typeof near.exact !== 'boolean') {
          throw new ValidationError('Fill step "near.exact" must be a boolean');
        }
      }
      break;

    case 'extract_attribute':
      // Must have either selector (legacy) or target (new)
      if (!params.selector && !params.target) {
        throw new ValidationError('ExtractAttribute step must have either "selector" or "target" in params');
      }
      if (params.selector !== undefined && typeof params.selector !== 'string') {
        throw new ValidationError('ExtractAttribute step "selector" must be a string');
      }
      if (params.target !== undefined) {
        validateTargetOrAnyOf(params.target);
      }
      if (typeof params.attribute !== 'string' || !params.attribute) {
        throw new ValidationError(
          'ExtractAttribute step must have a non-empty string "attribute" in params'
        );
      }
      if (typeof params.out !== 'string' || !params.out) {
        throw new ValidationError('ExtractAttribute step must have a non-empty string "out" in params');
      }
      if (params.first !== undefined && typeof params.first !== 'boolean') {
        throw new ValidationError('ExtractAttribute step "first" must be a boolean');
      }
      if (params.default !== undefined && typeof params.default !== 'string') {
        throw new ValidationError('ExtractAttribute step "default" must be a string');
      }
      if (params.hint !== undefined && typeof params.hint !== 'string') {
        throw new ValidationError('ExtractAttribute step "hint" must be a string');
      }
      if (params.scope !== undefined) {
        validateTarget(params.scope);
      }
      if (params.near !== undefined && params.near !== null) {
        const near = params.near as Record<string, unknown>;
        if (typeof near !== 'object' || near.kind !== 'text') {
          throw new ValidationError('ExtractAttribute step "near" must be an object with kind: "text"');
        }
        if (typeof near.text !== 'string') {
          throw new ValidationError('ExtractAttribute step "near.text" must be a string');
        }
        if (near.exact !== undefined && typeof near.exact !== 'boolean') {
          throw new ValidationError('ExtractAttribute step "near.exact" must be a boolean');
        }
      }
      break;

    case 'assert':
      if (!params.selector && !params.target && !params.urlIncludes) {
        throw new ValidationError('Assert step must have at least one of: selector, target, or urlIncludes');
      }
      if (params.selector !== undefined && typeof params.selector !== 'string') {
        throw new ValidationError('Assert step "selector" must be a string');
      }
      if (params.target !== undefined) {
        validateTargetOrAnyOf(params.target);
      }
      if (params.visible !== undefined && typeof params.visible !== 'boolean') {
        throw new ValidationError('Assert step "visible" must be a boolean');
      }
      if (params.textIncludes !== undefined && typeof params.textIncludes !== 'string') {
        throw new ValidationError('Assert step "textIncludes" must be a string');
      }
      if (params.urlIncludes !== undefined && typeof params.urlIncludes !== 'string') {
        throw new ValidationError('Assert step "urlIncludes" must be a string');
      }
      if (params.message !== undefined && typeof params.message !== 'string') {
        throw new ValidationError('Assert step "message" must be a string');
      }
      if (params.hint !== undefined && typeof params.hint !== 'string') {
        throw new ValidationError('Assert step "hint" must be a string');
      }
      if (params.scope !== undefined) {
        validateTarget(params.scope);
      }
      if (params.near !== undefined && params.near !== null) {
        const near = params.near as Record<string, unknown>;
        if (typeof near !== 'object' || near.kind !== 'text') {
          throw new ValidationError('Assert step "near" must be an object with kind: "text"');
        }
        if (typeof near.text !== 'string') {
          throw new ValidationError('Assert step "near.text" must be a string');
        }
        if (near.exact !== undefined && typeof near.exact !== 'boolean') {
          throw new ValidationError('Assert step "near.exact" must be a boolean');
        }
      }
      break;

    case 'set_var':
      if (typeof params.name !== 'string' || !params.name) {
        throw new ValidationError('SetVar step must have a non-empty string "name" in params');
      }
      const valueType = typeof params.value;
      if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
        throw new ValidationError('SetVar step "value" must be a string, number, or boolean');
      }
      break;

    case 'network_find':
      if (!params.where || typeof params.where !== 'object') {
        throw new ValidationError('NetworkFind step must have a "where" object in params');
      }
      const where = params.where as Record<string, unknown>;
      if (where.urlIncludes !== undefined && typeof where.urlIncludes !== 'string') {
        throw new ValidationError('NetworkFind step "where.urlIncludes" must be a string');
      }
      if (where.urlRegex !== undefined) {
        if (typeof where.urlRegex !== 'string') {
          throw new ValidationError('NetworkFind step "where.urlRegex" must be a string');
        }
        try {
          new RegExp(where.urlRegex);
        } catch {
          throw new ValidationError('NetworkFind step "where.urlRegex" is not a valid regex');
        }
      }
      if (where.method !== undefined) {
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        if (!validMethods.includes(where.method as string)) {
          throw new ValidationError(`NetworkFind step "where.method" must be one of: ${validMethods.join(', ')}`);
        }
      }
      if (where.status !== undefined && (typeof where.status !== 'number' || where.status < 0)) {
        throw new ValidationError('NetworkFind step "where.status" must be a non-negative number');
      }
      if (where.contentTypeIncludes !== undefined && typeof where.contentTypeIncludes !== 'string') {
        throw new ValidationError('NetworkFind step "where.contentTypeIncludes" must be a string');
      }
      if (where.responseContains !== undefined) {
        if (typeof where.responseContains !== 'string') {
          throw new ValidationError('NetworkFind step "where.responseContains" must be a string');
        }
        if (where.responseContains.length > 2000) {
          throw new ValidationError('NetworkFind step "where.responseContains" must be at most 2000 characters');
        }
      }
      if (params.pick !== undefined && params.pick !== 'first' && params.pick !== 'last') {
        throw new ValidationError('NetworkFind step "pick" must be "first" or "last"');
      }
      if (typeof params.saveAs !== 'string' || !params.saveAs) {
        throw new ValidationError('NetworkFind step must have a non-empty string "saveAs" in params');
      }
      if (params.saveAs.length > 500) {
        throw new ValidationError('NetworkFind step "saveAs" must be at most 500 characters');
      }
      if (params.waitForMs !== undefined && (typeof params.waitForMs !== 'number' || params.waitForMs < 0)) {
        throw new ValidationError('NetworkFind step "waitForMs" must be a non-negative number');
      }
      if (params.pollIntervalMs !== undefined && (typeof params.pollIntervalMs !== 'number' || params.pollIntervalMs < 100)) {
        throw new ValidationError('NetworkFind step "pollIntervalMs" must be at least 100');
      }
      break;

    case 'network_replay':
      if (typeof params.requestId !== 'string' || !params.requestId) {
        throw new ValidationError('NetworkReplay step must have a non-empty string "requestId" in params');
      }
      if (params.requestId.length > 2000) {
        throw new ValidationError('NetworkReplay step "requestId" must be at most 2000 characters');
      }
      const SENSITIVE_HEADERS = new Set([
        'authorization',
        'cookie',
        'set-cookie',
        'x-api-key',
        'proxy-authorization',
      ]);
      if (params.overrides && typeof params.overrides === 'object') {
        const overrides = params.overrides as Record<string, unknown>;
        if (overrides.setHeaders && typeof overrides.setHeaders === 'object') {
          for (const key of Object.keys(overrides.setHeaders as Record<string, unknown>)) {
            if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
              throw new ValidationError(`NetworkReplay step "overrides.setHeaders" cannot set sensitive header: ${key}`);
            }
          }
        }
        if (overrides.urlReplace !== undefined) {
          if (typeof overrides.urlReplace !== 'object' || overrides.urlReplace === null) {
            throw new ValidationError('NetworkReplay step "overrides.urlReplace" must be { find: string, replace: string }');
          }
          const ur = overrides.urlReplace as Record<string, unknown>;
          if (typeof ur.find !== 'string' || typeof ur.replace !== 'string') {
            throw new ValidationError('NetworkReplay step "overrides.urlReplace" must have string "find" and "replace"');
          }
          try {
            new RegExp(ur.find);
          } catch {
            throw new ValidationError('NetworkReplay step "overrides.urlReplace.find" is not a valid regex');
          }
        }
        if (overrides.bodyReplace !== undefined) {
          if (typeof overrides.bodyReplace !== 'object' || overrides.bodyReplace === null) {
            throw new ValidationError('NetworkReplay step "overrides.bodyReplace" must be { find: string, replace: string }');
          }
          const br = overrides.bodyReplace as Record<string, unknown>;
          if (typeof br.find !== 'string' || typeof br.replace !== 'string') {
            throw new ValidationError('NetworkReplay step "overrides.bodyReplace" must have string "find" and "replace"');
          }
          try {
            new RegExp(br.find);
          } catch {
            throw new ValidationError('NetworkReplay step "overrides.bodyReplace.find" is not a valid regex');
          }
        }
      }
      if (params.auth !== 'browser_context') {
        throw new ValidationError('NetworkReplay step "auth" must be "browser_context"');
      }
      if (typeof params.out !== 'string' || !params.out) {
        throw new ValidationError('NetworkReplay step must have a non-empty string "out" in params');
      }
      if (!params.response || typeof params.response !== 'object') {
        throw new ValidationError('NetworkReplay step must have a "response" object in params');
      }
      const resp = params.response as Record<string, unknown>;
      if (resp.as !== 'json' && resp.as !== 'text') {
        throw new ValidationError('NetworkReplay step "response.as" must be "json" or "text"');
      }
      if (resp.jsonPath !== undefined && typeof resp.jsonPath !== 'string') {
        throw new ValidationError('NetworkReplay step "response.jsonPath" must be a string');
      }
      break;

    case 'network_extract':
      if (typeof params.fromVar !== 'string' || !params.fromVar) {
        throw new ValidationError('NetworkExtract step must have a non-empty string "fromVar" in params');
      }
      if (params.as !== 'json' && params.as !== 'text') {
        throw new ValidationError('NetworkExtract step "as" must be "json" or "text"');
      }
      if (params.jsonPath !== undefined && typeof params.jsonPath !== 'string') {
        throw new ValidationError('NetworkExtract step "jsonPath" must be a string');
      }
      if (params.transform !== undefined) {
        if (typeof params.transform !== 'object' || params.transform === null || Array.isArray(params.transform)) {
          throw new ValidationError('NetworkExtract step "transform" must be an object mapping field names to jsonPath expressions');
        }
        for (const [key, val] of Object.entries(params.transform as Record<string, unknown>)) {
          if (typeof val !== 'string') {
            throw new ValidationError(`NetworkExtract step "transform.${key}" must be a string (jsonPath expression)`);
          }
        }
      }
      if (typeof params.out !== 'string' || !params.out) {
        throw new ValidationError('NetworkExtract step must have a non-empty string "out" in params');
      }
      break;

    default:
      throw new ValidationError(
        `Unknown step type: ${s.type}. Supported types: navigate, extract_title, extract_text, extract_attribute, sleep, wait_for, click, fill, assert, set_var, network_find, network_replay, network_extract`
      );
  }

  return true;
}

/**
 * Validates a flow (array of steps)
 */
export function validateFlow(steps: unknown[]): void {
  if (!Array.isArray(steps)) {
    throw new ValidationError('Flow must be an array of steps');
  }

  // Empty flow is allowed (e.g. user or AI deleted all steps)

  // Check for unique IDs
  const ids = new Set<string>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    validateStep(step);

    const stepId = (step as DslStep).id;
    if (ids.has(stepId)) {
      throw new ValidationError(`Duplicate step ID: ${stepId}`);
    }
    ids.add(stepId);
  }
}
