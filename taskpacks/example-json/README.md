# JSON-Only Example Task Pack

This example demonstrates a **pure JSON task pack** - no TypeScript, no build step, just a single `taskpack.json` file.

## Structure

```
example-json/
  └── taskpack.json  # Everything in one file!
```

## Features

- ✅ No build step required
- ✅ No TypeScript dependencies
- ✅ Single file - easy to share/transmit
- ✅ Perfect for simple automation flows
- ✅ DSL steps defined directly as JSON

## Usage

```bash
# Run directly - no build needed!
pnpm test:example-json

# Or manually:
node packages/harness/dist/cli.js run --pack ./taskpacks/example-json --inputs '{}'
```

## Comparison

**JSON-only (this example):**
- Single `taskpack.json` file
- Flow defined as JSON array
- No build step
- No TypeScript/IDE support

**TypeScript (see `../example`):**
- `taskpack.json` + `src/index.ts`
- Flow uses builder functions
- Requires build step
- Full TypeScript/IDE support

Both styles produce identical results - choose based on your needs!
