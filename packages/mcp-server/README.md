# Task Pack MCP Server

MCP (Model Context Protocol) server that exposes Task Packs as MCP tools. Each Task Pack becomes a callable tool that can be invoked with inputs and returns collectibles + metadata.

## Features

- **Automatic Pack Discovery**: Discovers Task Packs from one or more directories
- **Tool Mapping**: Each Task Pack is exposed as an MCP tool with its input schema
- **Concurrency Control**: Configurable concurrent execution limit
- **Structured Logging**: Per-run JSONL event logs and artifacts
- **Error Handling**: Captures screenshots and HTML on errors

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Start the MCP Server

```bash
tp-mcp --packs <dir1,dir2,...> [options]
```

### Options

- `--packs <dir1,dir2,...>` (required): Comma-separated list of directories containing Task Packs
- `--headful`: Run browser in headful mode (default: auto-detected from DISPLAY env var)
- `--headless`: Force headless mode (overrides auto-detection)
- `--concurrency <n>`: Maximum concurrent executions (default: 1)
- `--baseRunDir <path>`: Base directory for run outputs (default: `./runs`)

### Examples

```bash
# Basic usage - discover packs from taskpacks directory
tp-mcp --packs ./taskpacks

# Multiple directories with concurrency
tp-mcp --packs ./taskpacks,./custom-packs --concurrency 3

# Headful mode (browser window visible, requires X server)
# Auto-detects DISPLAY - if not set, falls back to headless with warning
tp-mcp --packs ./taskpacks --headful

# Force headless mode
tp-mcp --packs ./taskpacks --headless

# Use virtual display (xvfb) for headful mode without physical display
xvfb-run -a tp-mcp --packs ./taskpacks --headful

# Custom run directory
tp-mcp --packs ./taskpacks --baseRunDir ./custom-runs
```

## Pack Discovery

The server discovers Task Packs from specified directories:

- **Direct packs**: `./taskpacks/pack-name/taskpack.json`
- **Nested packs**: `./taskpacks/category/pack-name/taskpack.json` (one level deep)

Each valid Task Pack is registered as an MCP tool. Tool names are derived from the pack's `metadata.id`:
- Non-alphanumeric characters (except `.`, `_`, `-`) are replaced with `_`
- Example: `example.site.collector` → tool name `example.site.collector`
- Example: `my-pack/v1` → tool name `my_pack_v1`

If multiple packs map to the same tool name, only the first one is registered (warnings are logged).

## MCP Tool Interface

### Tool Name

Derived from `taskPack.metadata.id` (MCP-safe format).

### Tool Description

`{metadata.description} (v{metadata.version})`

### Input Schema

Derived from `taskPack.inputs`:
- Maps primitive types (`string`, `number`, `boolean`) to MCP schema types
- Includes field descriptions
- Marks required fields

### Tool Output

Returns a JSON object:

```json
{
  "taskId": "example.site.collector",
  "version": "0.1.0",
  "runId": "uuid-here",
  "meta": {
    "url": "https://example.com/",
    "durationMs": 1234,
    "notes": "Executed 3/3 steps"
  },
  "collectibles": {
    "page_title": "Example Domain",
    "h1_text": "Example Domain"
  },
  "runDir": "/path/to/runs/example.site.collector-2026-01-29T13-00-00-000Z-abc12345",
  "eventsPath": "/path/to/runs/.../events.jsonl",
  "artifactsDir": "/path/to/runs/.../artifacts"
}
```

On error, the response includes:
- `error`: Error message
- `meta.notes`: Error description
- `runDir`, `eventsPath`, `artifactsDir`: Paths to logs/artifacts (screenshot + HTML captured)

## Example Tool Invocation

### Request (MCP format)

```json
{
  "method": "tools/call",
  "params": {
    "name": "example.site.collector",
    "arguments": {}
  }
}
```

### Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"taskId\": \"example.site.collector\",\n  \"version\": \"0.1.0\",\n  \"runId\": \"...\",\n  \"meta\": {...},\n  \"collectibles\": {...},\n  \"runDir\": \"...\",\n  \"eventsPath\": \"...\",\n  \"artifactsDir\": \"...\"\n}"
    }
  ],
  "isError": false
}
```

## Server Logs

The server logs to stderr (stdout is reserved for MCP protocol):

```
[MCP Server] Starting with 2 task pack(s)
[MCP Server] Concurrency: 1, Headful: false
[MCP Server] Base run directory: ./runs
[MCP Server] Discovered 2 task pack(s):
[MCP Server]   - example.site.collector (example.site.collector v0.1.0)
[MCP Server]   - example.json.collector (example.json.collector v0.1.0)
[MCP Server] Server started and ready
[MCP Server] Tool invocation: example.site.collector (runId: ...)
[MCP Server] Tool completed: example.site.collector (runId: ...) - Success
```

## Run Artifacts

Each tool invocation creates a run directory:

```
runs/
  example.site.collector-2026-01-29T13-00-00-000Z-abc12345/
    events.jsonl          # Structured log events
    artifacts/           # Screenshots and HTML (on error)
      error.png
      error.html
```

## Integration

### Stdio Transport (CLI)

The server uses stdio transport and can be integrated with any MCP client:

```json
{
  "mcpServers": {
    "taskpack": {
      "command": "tp-mcp",
      "args": ["--packs", "./taskpacks"]
    }
  }
}
```

### HTTP/SSE Transport (Dashboard)

When started from the dashboard, the server uses Streamable HTTP (HTTP/SSE) transport in **stateless mode**. No session initialization is required - you can directly send MCP requests to the server URL.

**Example Request:**
```bash
POST http://127.0.0.1:3340
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "example.site.collector",
    "arguments": {}
  }
}
```

## Requirements

- Node.js 20+
- Playwright Chromium browser installed (`pnpm exec playwright install chromium`)
- Task Packs must be built (if using TypeScript packs)
