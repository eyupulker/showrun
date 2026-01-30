# MCPify Dashboard

A real-time dashboard for running and observing Task Packs. This dashboard provides a web UI to discover task packs, trigger runs, and stream live run events.

## Quick Start

### Via npx (when published)

```bash
npx mcpify-dashboard
```

### Local Development

```bash
# Build the dashboard (from project root)
pnpm build

# Run it (choose one method):
# Method 1: Using pnpm filter (recommended)
pnpm --filter @mcpify/dashboard start

# Method 2: Direct node execution
node packages/dashboard/dist/cli.js

# Method 3: From dashboard directory
cd packages/dashboard && pnpm start
```

**Note**: `pnpm exec mcpify-dashboard` won't work for workspace packages. Use `pnpm --filter @mcpify/dashboard start` instead.

## Usage

```bash
mcpify-dashboard [options]

Options:
  --packs <dir1,dir2>    Comma-separated list of directories to search for task packs
                         (default: ./taskpacks if exists)
  --port <n>             Port to bind the server to (default: 3333)
  --host <hostname>      Hostname or IP to bind to (default: 127.0.0.1)
                         WARNING: Only use this if you understand the security implications
  --headful              Run browser in headful mode (default: false)
  --baseRunDir <path>    Base directory for run outputs (default: ./runs-dashboard)
  --help, -h             Show this help message
```

### Examples

```bash
# Basic usage (discovers packs from ./taskpacks)
mcpify-dashboard

# Custom packs directory
mcpify-dashboard --packs ./taskpacks,./custom-packs

# Custom port
mcpify-dashboard --port 4000

# Headful mode (show browser)
mcpify-dashboard --headful

# Custom run directory
mcpify-dashboard --baseRunDir ./my-runs
```

## Features

### Task Pack Discovery
- Automatically discovers task packs from specified directories
- Validates packs and shows metadata (id, name, version, description)
- Displays input schema and collectibles schema

### Run Management
- Queue and execute task packs with JSON inputs
- View run history with status (queued/running/success/failed)
- See run details including duration, collectibles, and paths

### Real-time Event Streaming
- Live event stream via Socket.IO
- Events include: `run_started`, `step_started`, `step_finished`, `error`, `run_finished`
- Events are written to JSONL files and streamed to the UI simultaneously

## Security

The dashboard implements several security measures:

1. **Localhost-only binding**: By default, the server binds to `127.0.0.1` only
2. **Session token authentication**: A random token is generated on startup and required for:
   - Socket.IO connections
   - POST requests to `/api/runs`
3. **Strict pack allowlist**: Only packs from explicitly provided `--packs` directories can be run
4. **No arbitrary path execution**: Pack IDs must match discovered packs
5. **Input validation**: All inputs are validated against pack schemas

### Security Notes

- The dashboard is designed for **local development use only**
- Do not expose the dashboard to untrusted networks
- If you need to access from other machines, use `--host` carefully and ensure your network is secure
- The session token is displayed in the console on startup

## Architecture

- **Backend**: Express.js server with Socket.IO for real-time updates
- **Frontend**: React + Vite SPA
- **Runner**: Reuses `runTaskPack` from `@mcpify/core`
- **Logger**: Custom `SocketLogger` that writes JSONL and emits socket events
- **Queue**: Concurrency-limited run queue (default: 1 concurrent run)

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Development mode (watch)
pnpm dev
```

## Future Enhancements

- Teach Mode: DOM overlay for step labeling and recording
- Task Pack Creation UI
- User authentication
- Remote deployment support
