# @showrun/core

Core types, utilities, and runtime for the ShowRun Task Pack framework. This package provides the foundational building blocks for deterministic browser automation.

## Overview

`@showrun/core` is the foundation of ShowRun's Task Pack system. It provides:

- **Type Definitions**: TypeScript types for Task Packs, DSL steps, and schemas
- **Task Pack Loading**: Discovery and validation of Task Pack directories
- **DSL Interpreter**: Execution engine for declarative automation steps
- **Runner**: Browser automation orchestration with Playwright
- **Network Capture**: Request/response recording and replay
- **Browser Persistence**: Profile and session management
- **Auth Resilience**: Automatic authentication recovery
- **Configuration**: Layered config system with defaults

## Installation

```bash
pnpm add @showrun/core
```

## Key Concepts

### Task Pack

A Task Pack is a self-contained automation module with:

- **Metadata**: ID, name, version, description (`taskpack.json`)
- **Flow Definition**: Inputs, collectibles, and DSL steps (`flow.json`)
- **Input Schema**: Type-safe parameter definitions
- **Collectibles**: Structured data extracted during execution
- **Secrets**: Optional encrypted credentials (`.secrets.json`)

### DSL (Domain-Specific Language)

ShowRun uses a declarative JSON-based DSL for browser automation. Steps are plain objects (no functions) that describe actions:

```json
{
  "step": "navigate",
  "url": "https://example.com"
}
```

All DSL steps are defined in `dsl/types.ts` and executed by the interpreter.

### JSON-DSL Format

Task Packs use the `json-dsl` format with two files:

```
taskpack-name/
├── taskpack.json   # Metadata with "kind": "json-dsl"
└── flow.json       # Inputs, collectibles, and flow array
```

**Note**: TypeScript-based task packs are no longer supported. Only JSON-DSL format is accepted.

## API Reference

### Loading Task Packs

```typescript
import { TaskPackLoader } from '@showrun/core';

// Load a task pack from directory
const taskPack = TaskPackLoader.load('/path/to/taskpack');

// Load manifest only
const manifest = TaskPackLoader.loadManifest('/path/to/taskpack');

// Load secrets
const secrets = TaskPackLoader.loadSecrets('/path/to/taskpack');
```

### Validating Inputs

```typescript
import { validateInputs } from '@showrun/core';

const inputs = { username: 'test', count: 5 };
const validation = validateInputs(inputs, taskPack.inputs);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Running Task Packs

```typescript
import { runTaskPack } from '@showrun/core';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const result = await runTaskPack({
  taskPack,
  inputs: { username: 'demo' },
  page,
  logger: console,
  runDir: './runs/example-run'
});

console.log('Collectibles:', result.collectibles);
console.log('Duration:', result.meta.durationMs);

await browser.close();
```

### DSL Step Execution

The DSL interpreter automatically executes steps from the flow:

```typescript
import { interpretDslSteps } from '@showrun/core/dsl';

await interpretDslSteps({
  flow: taskPack.flow,
  page,
  inputs,
  logger,
  runDir
});
```

## DSL Step Types

### Navigation

- **`navigate`**: Go to URL
- **`wait_ms`**: Pause execution (milliseconds)
- **`wait_for_network_idle`**: Wait for network to settle
- **`wait_for_element`**: Wait for element visibility
- **`wait_for_selector`**: Wait for CSS selector

### Interaction

- **`click`**: Click element by target (text, role, label, selector)
- **`fill`**: Fill input field
- **`select_option`**: Select dropdown option
- **`check`**: Check checkbox
- **`uncheck`**: Uncheck checkbox
- **`press_key`**: Press keyboard key
- **`hover`**: Hover over element

### Data Extraction

- **`extract_text`**: Extract text content from element
- **`extract_attribute`**: Extract HTML attribute value
- **`extract_url`**: Capture current URL
- **`extract_screenshot`**: Take screenshot (base64)

### Network Operations

- **`network_find`**: Search captured network requests
- **`network_replay`**: Replay a captured request with modifications
- **`network_extract`**: Extract data from API response using JMESPath

### Variables & Logic

- **`set_var`**: Set a variable (supports templating)
- **`assert_equals`**: Assert variable equals expected value
- **`assert_url_contains`**: Assert URL contains text
- **`conditional execution`**: Use `skip_if` on any step for conditional logic

### Authentication

- **`input_otp`**: Generate and input TOTP code from secret
- **`auth_check`**: Verify authentication state
- **`auth_recover`**: Attempt to recover authentication

### Advanced

- **`custom_script`**: Execute custom JavaScript in page context

## Target System

Steps use a flexible target system for element selection:

```typescript
// CSS selector
{ kind: 'css', selector: '.submit-button' }

// Text content
{ kind: 'text', text: 'Sign In', exact: false }

// ARIA role
{ kind: 'role', role: 'button', name: 'Submit' }

// Form label
{ kind: 'label', text: 'Username' }

// Placeholder text
{ kind: 'placeholder', text: 'Enter email' }

// Alt text (images)
{ kind: 'altText', text: 'Logo' }

// Test ID
{ kind: 'testId', id: 'submit-btn' }

// Fallback targets
{ anyOf: [
  { kind: 'text', text: 'Login' },
  { kind: 'role', role: 'button', name: 'Sign In' }
]}
```

## Network Capture & Replay

ShowRun can capture network requests during browser execution and replay them without a browser:

```typescript
import { NetworkCapture } from '@showrun/core';

// Capture is automatically enabled during runTaskPack
// Access via context:
const requests = networkCapture.list({ filter: 'api' });
const request = networkCapture.get('request-id');
const response = await networkCapture.getResponse('request-id');

// Replay a request with modifications
const result = await networkCapture.replay('request-id', {
  body: { modified: 'data' },
  headers: { 'X-Custom': 'value' }
});
```

### Request Snapshots

Snapshots enable HTTP-only execution (no browser) for API-only flows:

```typescript
import { loadSnapshots, snapshotsAreValid } from '@showrun/core';

const snapshots = loadSnapshots(packPath);
if (snapshotsAreValid(snapshots, { maxAge: 3600000 })) {
  // Run pack in HTTP-only mode using snapshots
}
```

## Browser Persistence

Control how browser data (cookies, localStorage, etc.) persists across runs:

```typescript
// In taskpack.json
{
  "browser": {
    "engine": "camoufox",
    "persistence": "profile"  // "none" | "session" | "profile"
  }
}
```

- **`none`**: Fresh browser each run (default)
- **`session`**: Persist in temp directory, cleared after 30min inactivity
- **`profile`**: Persist in pack's `.browser-profile/` directory (permanent)

## Auth Resilience

Automatic authentication recovery when sessions expire:

```typescript
// In taskpack.json
{
  "auth": {
    "check": {
      "element_visible": { "kind": "text", "text": "Dashboard" }
    },
    "recover": "auth.flow.json"
  }
}
```

The runner automatically detects auth failures and executes the recovery flow.

## Configuration System

Layered configuration with defaults:

```typescript
import { loadConfig, type ShowRunConfig } from '@showrun/core/config';

const config = await loadConfig({
  workingDir: process.cwd(),
  useGlobal: true
});

console.log(config.llm.provider);  // 'anthropic' | 'openai'
console.log(config.agent.maxBrowserRounds);  // 0 = unlimited
```

Config sources (in order of precedence):
1. Environment variables (`.env` files)
2. Local `.showrun/config.json`
3. Global config (`~/.config/showrun/config.json`)
4. Built-in defaults

## Templating

Variables can be used in DSL steps with Nunjucks syntax:

```json
{
  "step": "navigate",
  "url": "{{vars.baseUrl}}/users/{{vars.userId}}"
}
```

Supports filters for encoding:
- `{{vars.query | urlencode}}`
- Custom filters can be added

## Error Handling

Per-step error control:

```json
{
  "step": "click",
  "target": { "kind": "text", "text": "Optional Button" },
  "optional": true,
  "onError": "continue"
}
```

- **`optional: true`**: Step failure doesn't stop execution
- **`onError: "continue"`**: Continue on error (default: `"stop"`)

## Conditional Execution

Skip steps based on conditions:

```json
{
  "step": "click",
  "target": { "kind": "text", "text": "Login" },
  "skip_if": {
    "element_visible": { "kind": "text", "text": "Dashboard" }
  }
}
```

Supported conditions:
- `url_includes`, `url_matches`
- `element_visible`, `element_exists`
- `var_equals`, `var_truthy`, `var_falsy`
- `all` (combine multiple conditions with AND logic)

## Logging

ShowRun uses structured logging via Winston:

```typescript
import { createLogger } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.json(),
  transports: [new transports.Console()]
});

await runTaskPack({
  taskPack,
  inputs,
  page,
  logger  // Pass your logger
});
```

Events are also written to JSONL (`events.jsonl`) in the run directory.

## Package Structure

```
packages/core/
├── src/
│   ├── types.ts              # Core type definitions
│   ├── loader.ts             # Task Pack loading
│   ├── validator.ts          # Input validation
│   ├── runner.ts             # Execution orchestration
│   ├── context.ts            # Execution context management
│   ├── networkCapture.ts     # Network recording
│   ├── requestSnapshot.ts    # Snapshot persistence
│   ├── httpReplay.ts         # HTTP-only execution
│   ├── browserLauncher.ts    # Browser initialization
│   ├── browserPersistence.ts # Profile management
│   ├── authResilience.ts     # Auth recovery
│   ├── config.ts             # Configuration system
│   ├── packUtils.ts          # Pack discovery utilities
│   ├── packVersioning.ts     # Version comparison
│   └── dsl/
│       ├── types.ts          # DSL step type definitions
│       ├── builders.ts       # Step builder utilities
│       ├── interpreter.ts    # Step execution engine
│       ├── validation.ts     # Flow validation
│       ├── templating.ts     # Variable interpolation
│       ├── target.ts         # Element targeting
│       └── conditions.ts     # Skip condition evaluation
└── dist/                     # Compiled output
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  TaskPack,
  TaskPackManifest,
  InputSchema,
  CollectibleDefinition,
  DslStep,
  Target,
  SkipCondition
} from '@showrun/core';
```

## Browser Engines

Two browser engines are supported:

- **Chromium** (Playwright default)
- **Camoufox** (anti-detection Firefox fork)

Specify in `taskpack.json`:

```json
{
  "browser": {
    "engine": "camoufox"
  }
}
```

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

## Dependencies

- **playwright**: Browser automation
- **camoufox-js**: Anti-detection browser
- **@jmespath-community/jmespath**: JSON query language
- **nunjucks**: Template engine
- **otplib**: TOTP generation

## Related Packages

- **[@showrun/harness](../harness)**: Task Pack execution library
- **[@showrun/dashboard](../dashboard)**: Web UI with Teach Mode
- **[@showrun/mcp-server](../mcp-server)**: MCP server exposing packs as tools
- **[showrun](../showrun)**: Unified CLI

## License

MIT
