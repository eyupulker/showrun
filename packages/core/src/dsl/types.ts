/**
 * DSL Step Types
 * 
 * Defines the structure for declarative browser automation steps.
 * All steps are plain objects (JSON-serializable) with no functions.
 */

/**
 * Per-step error handling options
 */
export type StepErrorBehavior = 'stop' | 'continue';

/**
 * Playwright role types (subset of most common ones)
 */
export type PlaywrightRole =
  | 'button'
  | 'checkbox'
  | 'combobox'
  | 'dialog'
  | 'gridcell'
  | 'link'
  | 'listbox'
  | 'menuitem'
  | 'option'
  | 'radio'
  | 'searchbox'
  | 'slider'
  | 'switch'
  | 'tab'
  | 'tabpanel'
  | 'textbox'
  | 'treeitem'
  | 'article'
  | 'banner'
  | 'complementary'
  | 'contentinfo'
  | 'form'
  | 'main'
  | 'navigation'
  | 'region'
  | 'search'
  | 'alert'
  | 'log'
  | 'marquee'
  | 'status'
  | 'timer';

/**
 * Target strategies for element selection
 * Human-stable selectors suitable for Teach Mode
 */
export type Target =
  | { kind: 'css'; selector: string }
  | { kind: 'text'; text: string; exact?: boolean }
  | { kind: 'role'; role: PlaywrightRole; name?: string; exact?: boolean }
  | { kind: 'label'; text: string; exact?: boolean }
  | { kind: 'placeholder'; text: string; exact?: boolean }
  | { kind: 'altText'; text: string; exact?: boolean }
  | { kind: 'testId'; id: string };

/**
 * Target with optional metadata for Teach Mode
 */
export interface TargetWithMetadata {
  /**
   * Primary target or fallback targets
   */
  target: Target | { anyOf: Target[] };
  /**
   * Human-readable hint (for Teach Mode, ignored at runtime except logging)
   */
  hint?: string;
  /**
   * Scope: limit search within a container
   */
  scope?: Target;
  /**
   * Optional adjacency hint (for Teach Mode, may be logged only in MVP)
   */
  near?: { kind: 'text'; text: string; exact?: boolean };
}

/**
 * Target or anyOf fallback structure
 */
export type TargetOrAnyOf = Target | { anyOf: Target[] };

/**
 * Base step interface with common fields
 */
export interface BaseDslStep {
  id: string;
  type: string;
  /**
   * Human-readable label for logs/UI
   */
  label?: string;
  /**
   * Per-step timeout override (milliseconds)
   */
  timeoutMs?: number;
  /**
   * If true, step failure won't fail the run
   */
  optional?: boolean;
  /**
   * Error handling behavior for this step
   */
  onError?: StepErrorBehavior;
  /**
   * Run-once flag: if set, step is skipped if already executed for this session/profile
   * - "session": cached per sessionId (cleared on auth recovery)
   * - "profile": cached per profileId (cleared on auth recovery)
   */
  once?: 'session' | 'profile';
}

/**
 * Navigate step - navigates to a URL
 */
export interface NavigateStep extends BaseDslStep {
  type: 'navigate';
  params: {
    url: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  };
}

/**
 * Extract title step - extracts page title
 */
export interface ExtractTitleStep extends BaseDslStep {
  type: 'extract_title';
  params: {
    out: string; // collectible key to store the result
  };
}

/**
 * Extract text step - extracts text from a target
 */
export interface ExtractTextStep extends BaseDslStep {
  type: 'extract_text';
  params: {
    /**
     * Target for element selection (supports selector for backward compatibility)
     * @deprecated Use target instead of selector
     */
    selector?: string;
    /**
     * Target for element selection (human-stable selectors)
     */
    target?: TargetOrAnyOf;
    out: string; // collectible key to store the result
    first?: boolean; // if true, only get first match (default: true)
    trim?: boolean; // if true, trim whitespace (default: true)
    default?: string; // default value if element not found
    /**
     * Optional metadata for Teach Mode
     */
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  };
}

/**
 * Sleep step - waits for a specified duration
 * @deprecated Prefer wait_for for deterministic waiting
 */
export interface SleepStep extends BaseDslStep {
  type: 'sleep';
  params: {
    durationMs: number; // duration to wait in milliseconds
  };
}

/**
 * Wait for step - deterministic waiting for conditions
 */
export interface WaitForStep extends BaseDslStep {
  type: 'wait_for';
  params: {
    /**
     * Wait for target to be visible (or present if visible: false)
     * @deprecated Use target instead of selector
     */
    selector?: string;
    /**
     * Target for element selection (human-stable selectors)
     */
    target?: TargetOrAnyOf;
    /**
     * If target provided, wait for visibility (default: true)
     */
    visible?: boolean;
    /**
     * OR wait for URL to match pattern
     */
    url?: string | { pattern: string; exact?: boolean };
    /**
     * OR wait for page load state
     */
    loadState?: 'load' | 'domcontentloaded' | 'networkidle';
    /**
     * Timeout in milliseconds (default: 30000)
     */
    timeoutMs?: number;
    /**
     * Optional metadata for Teach Mode
     */
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  };
}

/**
 * Click step - clicks an element
 */
export interface ClickStep extends BaseDslStep {
  type: 'click';
  params: {
    /**
     * Target for element selection (supports selector for backward compatibility)
     * @deprecated Use target instead of selector
     */
    selector?: string;
    /**
     * Target for element selection (human-stable selectors)
     */
    target?: TargetOrAnyOf;
    /**
     * If true, only click first match (default: true)
     */
    first?: boolean;
    /**
     * Wait for element to be visible before clicking (default: true)
     */
    waitForVisible?: boolean;
    /**
     * Optional metadata for Teach Mode
     */
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  };
}

/**
 * Fill step - fills an input field
 */
export interface FillStep extends BaseDslStep {
  type: 'fill';
  params: {
    /**
     * Target for element selection (supports selector for backward compatibility)
     * @deprecated Use target instead of selector
     */
    selector?: string;
    /**
     * Target for element selection (human-stable selectors)
     */
    target?: TargetOrAnyOf;
    value: string;
    /**
     * If true, only fill first match (default: true)
     */
    first?: boolean;
    /**
     * Clear field before filling (default: true)
     */
    clear?: boolean;
    /**
     * Optional metadata for Teach Mode
     */
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  };
}

/**
 * Extract attribute step - extracts an attribute value from an element
 */
export interface ExtractAttributeStep extends BaseDslStep {
  type: 'extract_attribute';
  params: {
    /**
     * Target for element selection (supports selector for backward compatibility)
     * @deprecated Use target instead of selector
     */
    selector?: string;
    /**
     * Target for element selection (human-stable selectors)
     */
    target?: TargetOrAnyOf;
    attribute: string; // e.g., 'href', 'src', 'data-id'
    out: string; // collectible key to store the result
    first?: boolean; // if true, only get first match (default: true)
    default?: string; // default value if element/attribute not found
    /**
     * Optional metadata for Teach Mode
     */
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  };
}

/**
 * Assert step - assertions for validation
 */
export interface AssertStep extends BaseDslStep {
  type: 'assert';
  params: {
    /**
     * Assert element exists (supports selector for backward compatibility)
     * @deprecated Use target instead of selector
     */
    selector?: string;
    /**
     * Target for element selection (human-stable selectors)
     */
    target?: TargetOrAnyOf;
    /**
     * Assert element is visible (requires target/selector)
     */
    visible?: boolean;
    /**
     * Assert element text includes value (requires target/selector)
     */
    textIncludes?: string;
    /**
     * Assert URL includes value
     */
    urlIncludes?: string;
    /**
     * Custom error message if assertion fails
     */
    message?: string;
    /**
     * Optional metadata for Teach Mode
     */
    hint?: string;
    scope?: Target;
    near?: { kind: 'text'; text: string; exact?: boolean };
  };
}

/**
 * Set variable step - sets a variable for use in templating
 */
export interface SetVarStep extends BaseDslStep {
  type: 'set_var';
  params: {
    name: string; // variable name
    value: string | number | boolean; // variable value
  };
}

/**
 * Network find step - search captured traffic and save request id to vars
 */
export interface NetworkFindStep extends BaseDslStep {
  type: 'network_find';
  params: {
    where: {
      urlIncludes?: string;
      urlRegex?: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      status?: number;
      contentTypeIncludes?: string;
      /** Response body (text) must contain this string. Only entries with captured response body are considered. */
      responseContains?: string;
    };
    pick?: 'last' | 'first'; // default last
    saveAs: string; // vars key to store the found requestId
    /** If set, wait up to this many ms for a matching request to appear (polls the buffer). Use when the request may happen after the step runs (e.g. after navigation or interaction). */
    waitForMs?: number;
    /** When waitForMs is set, poll the buffer every this many ms. Default 400. */
    pollIntervalMs?: number;
  };
}

/**
 * Network replay step - replay a captured request (optionally with overrides), store result
 */
export interface NetworkReplayStep extends BaseDslStep {
  type: 'network_replay';
  params: {
    requestId: string; // may be template "{{vars.lastReq}}"
    overrides?: {
      url?: string;
      setQuery?: Record<string, string | number>;
      setHeaders?: Record<string, string>;
      body?: string;
      /** Regex find/replace on captured URL; replace can use $1, $2. Supports {{vars.xxx}}/{{inputs.xxx}} (resolved before replace). */
      urlReplace?: { find: string; replace: string };
      /** Regex find/replace on captured body; replace can use $1, $2. Supports {{vars.xxx}}/{{inputs.xxx}} (resolved before replace). */
      bodyReplace?: { find: string; replace: string };
    };
    auth: 'browser_context'; // required for MVP
    out: string; // collectible key
    saveAs?: string; // optional vars key for raw result
    response: {
      as: 'json' | 'text';
      jsonPath?: string; // optional extraction from JSON
    };
  };
}

/**
 * Network extract step - extract from a previously replayed response stored in vars
 */
export interface NetworkExtractStep extends BaseDslStep {
  type: 'network_extract';
  params: {
    fromVar: string;
    as: 'json' | 'text';
    jsonPath?: string;
    out: string;
  };
}

/**
 * Union type of all supported DSL steps
 */
export type DslStep =
  | NavigateStep
  | ExtractTitleStep
  | ExtractTextStep
  | ExtractAttributeStep
  | SleepStep
  | WaitForStep
  | ClickStep
  | FillStep
  | AssertStep
  | SetVarStep
  | NetworkFindStep
  | NetworkReplayStep
  | NetworkExtractStep;

/**
 * Options for running a flow
 */
export interface RunFlowOptions {
  /**
   * Whether to stop on first error (default: true)
   */
  stopOnError?: boolean;
}

/**
 * Variable context for templating
 */
export interface VariableContext {
  inputs: Record<string, unknown>;
  vars: Record<string, unknown>;
}

/**
 * Result of running a flow
 */
export interface RunFlowResult {
  collectibles: Record<string, unknown>;
  meta: {
    url?: string;
    durationMs: number;
    stepsExecuted: number;
    stepsTotal: number;
  };
}
