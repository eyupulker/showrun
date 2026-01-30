import type {
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
  Target,
  TargetOrAnyOf,
  PlaywrightRole,
} from './types.js';

/**
 * Builder functions for creating DSL steps.
 * These return plain objects that are JSON-serializable.
 */

/**
 * Helper builders for creating Target objects
 */
export function targetCss(selector: string): Target {
  return { kind: 'css', selector };
}

export function targetText(text: string, exact?: boolean): Target {
  return { kind: 'text', text, exact };
}

export function targetRole(role: PlaywrightRole, name?: string, exact?: boolean): Target {
  return { kind: 'role', role, name, exact };
}

export function targetLabel(text: string, exact?: boolean): Target {
  return { kind: 'label', text, exact };
}

export function targetPlaceholder(text: string, exact?: boolean): Target {
  return { kind: 'placeholder', text, exact };
}

export function targetAltText(text: string, exact?: boolean): Target {
  return { kind: 'altText', text, exact };
}

export function targetTestId(id: string): Target {
  return { kind: 'testId', id };
}

export function targetAnyOf(...targets: Target[]): { anyOf: Target[] } {
  return { anyOf: targets };
}

/**
 * Creates a navigate step
 */
export function navigate(
  id: string,
  params: {
    url: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
  }
): NavigateStep {
  return {
    id,
    type: 'navigate',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      url: params.url,
      waitUntil: params.waitUntil ?? 'networkidle',
    },
  };
}

/**
 * Creates an extract_title step
 */
export function extractTitle(
  id: string,
  params: {
    out: string;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
  }
): ExtractTitleStep {
  return {
    id,
    type: 'extract_title',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      out: params.out,
    },
  };
}

/**
 * Creates an extract_text step
 */
export function extractText(
  id: string,
  params: {
    selector?: string; // Legacy support
    target?: TargetOrAnyOf; // New human-stable selectors
    out: string;
    first?: boolean;
    trim?: boolean;
    default?: string;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  }
): ExtractTextStep {
  return {
    id,
    type: 'extract_text',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      selector: params.selector,
      target: params.target,
      out: params.out,
      first: params.first ?? true,
      trim: params.trim ?? true,
      default: params.default,
      hint: params.hint,
      scope: params.scope,
      near: params.near,
    },
  };
}

/**
 * Creates a sleep step
 * @deprecated Prefer wait_for for deterministic waiting
 */
export function sleep(
  id: string,
  params: {
    durationMs: number;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
  }
): SleepStep {
  return {
    id,
    type: 'sleep',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      durationMs: params.durationMs,
    },
  };
}

/**
 * Creates a wait_for step
 */
export function waitFor(
  id: string,
  params: {
    selector?: string; // Legacy support
    target?: TargetOrAnyOf; // New human-stable selectors
    visible?: boolean;
    url?: string | { pattern: string; exact?: boolean };
    loadState?: 'load' | 'domcontentloaded' | 'networkidle';
    timeoutMs?: number;
    label?: string;
    optional?: boolean;
    onError?: 'stop' | 'continue';
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  }
): WaitForStep {
  return {
    id,
    type: 'wait_for',
    label: params.label,
    timeoutMs: params.timeoutMs ?? params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      selector: params.selector,
      target: params.target,
      visible: params.visible ?? true,
      url: params.url,
      loadState: params.loadState,
      timeoutMs: params.timeoutMs ?? 30000,
      hint: params.hint,
      scope: params.scope,
      near: params.near,
    },
  };
}

/**
 * Creates a click step
 */
export function click(
  id: string,
  params: {
    selector?: string; // Legacy support
    target?: TargetOrAnyOf; // New human-stable selectors
    first?: boolean;
    waitForVisible?: boolean;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  }
): ClickStep {
  return {
    id,
    type: 'click',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      selector: params.selector,
      target: params.target,
      first: params.first ?? true,
      waitForVisible: params.waitForVisible ?? true,
      hint: params.hint,
      scope: params.scope,
      near: params.near,
    },
  };
}

/**
 * Creates a fill step
 */
export function fill(
  id: string,
  params: {
    selector?: string; // Legacy support
    target?: TargetOrAnyOf; // New human-stable selectors
    value: string;
    first?: boolean;
    clear?: boolean;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  }
): FillStep {
  return {
    id,
    type: 'fill',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      selector: params.selector,
      target: params.target,
      value: params.value,
      first: params.first ?? true,
      clear: params.clear ?? true,
      hint: params.hint,
      scope: params.scope,
      near: params.near,
    },
  };
}

/**
 * Creates an extract_attribute step
 */
export function extractAttribute(
  id: string,
  params: {
    selector?: string; // Legacy support
    target?: TargetOrAnyOf; // New human-stable selectors
    attribute: string;
    out: string;
    first?: boolean;
    default?: string;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  }
): ExtractAttributeStep {
  return {
    id,
    type: 'extract_attribute',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      selector: params.selector,
      target: params.target,
      attribute: params.attribute,
      out: params.out,
      first: params.first ?? true,
      default: params.default,
      hint: params.hint,
      scope: params.scope,
      near: params.near,
    },
  };
}

/**
 * Creates an assert step
 */
export function assert(
  id: string,
  params: {
    selector?: string; // Legacy support
    target?: TargetOrAnyOf; // New human-stable selectors
    visible?: boolean;
    textIncludes?: string;
    urlIncludes?: string;
    message?: string;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  }
): AssertStep {
  return {
    id,
    type: 'assert',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      selector: params.selector,
      target: params.target,
      visible: params.visible,
      textIncludes: params.textIncludes,
      urlIncludes: params.urlIncludes,
      message: params.message,
      hint: params.hint,
      scope: params.scope,
      near: params.near,
    },
  };
}

/**
 * Creates a set_var step
 */
export function setVar(
  id: string,
  params: {
    name: string;
    value: string | number | boolean;
    label?: string;
    timeoutMs?: number;
    optional?: boolean;
    onError?: 'stop' | 'continue';
  }
): SetVarStep {
  return {
    id,
    type: 'set_var',
    label: params.label,
    timeoutMs: params.timeoutMs,
    optional: params.optional,
    onError: params.onError,
    params: {
      name: params.name,
      value: params.value,
    },
  };
}
