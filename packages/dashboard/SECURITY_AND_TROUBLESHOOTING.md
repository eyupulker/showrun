# Dashboard Security and Troubleshooting Guide

## Security

### Overview

The ShowRun dashboard implements multiple security layers designed for **local development use only**. It should never be exposed to untrusted networks or the public internet without additional hardening.

### Security Features

#### 1. Session Token Authentication

A random 64-character session token is generated on startup:

````bash
[Dashboard] Session token: a1b2c3d4...
````

This token is required for:
- **Socket.IO connections**: Validated in handshake middleware
- **HTTP POST requests**: Checked via `x-session-token` header or `token` query parameter

**How it works:**
- Token is generated with `crypto.randomBytes(32).toString('hex')` on server startup
- Frontend receives token via `/api/config` endpoint
- Socket.IO client includes token in `auth` object during connection
- HTTP routes use `createTokenChecker` middleware to validate requests

**Client code example:**
````typescript
// Socket.IO connection with token
const socket = io('http://localhost:3333', {
  auth: { token: sessionToken }
});

// HTTP POST request with token
fetch('/api/runs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': sessionToken
  },
  body: JSON.stringify({ packId, inputs })
});
````

#### 2. Localhost-Only Binding

By default, the server binds to `127.0.0.1` (localhost only):

````bash
showrun dashboard --packs ./taskpacks
# Binds to 127.0.0.1:3333
````

**Accessing from other machines:**

If you need to access the dashboard from another device on your network:

````bash
showrun dashboard --packs ./taskpacks --host 0.0.0.0
````

**⚠️ WARNING:** When using `--host 0.0.0.0`, the dashboard becomes accessible to any device on your network. Ensure:
- You trust all devices on your network
- Your network firewall is properly configured
- You understand the security implications of exposing development tools

#### 3. Pack Directory Allowlist

Only task packs from explicitly specified `--packs` directories can be discovered and executed:

````bash
showrun dashboard --packs ./taskpacks,./custom-packs
# Only packs in these directories are accessible
````

**Why this matters:**
- Prevents execution of arbitrary task packs from unknown sources
- Limits scope of potential malicious pack execution
- Enforces explicit trust boundaries

#### 4. Input Validation

All task pack inputs are validated against the pack's JSON schema:

- Schema validation happens in `@showrun/core` validator
- Invalid inputs are rejected before execution
- Type coercion and default values are applied per schema

#### 5. CORS Policy

By default, Socket.IO accepts connections from any origin (`origin: '*'`):

````typescript
// Current configuration (server.ts)
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*', // ⚠️ Permissive for local development
    methods: ['GET', 'POST'],
  },
});
````

**Future improvement:**

For production deployments, restrict CORS origins:

````typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:3333', 'http://127.0.0.1:3333'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
````

See [PR #42](https://github.com/eyupulker/showrun/pull/42) for the planned CORS restriction implementation.

### What the Dashboard Does NOT Protect Against

The dashboard is designed for **local development only**. It does not implement:

- ❌ **User authentication**: No login system, no user accounts
- ❌ **HTTPS/TLS**: Connections are unencrypted HTTP
- ❌ **Rate limiting**: No protection against brute force or DoS
- ❌ **Audit logging**: No comprehensive security event logging
- ❌ **Sandboxing**: Task packs run with full system access via Playwright
- ❌ **Content Security Policy**: No CSP headers on the frontend
- ❌ **Input sanitization**: HTML/JS injection possible in task pack outputs

### Security Best Practices

#### DO:
✅ Run the dashboard on `localhost` only (default behavior)  
✅ Keep API keys in `config.json` or `.env`, never commit them  
✅ Use `--workspace` to control where packs can be created/edited  
✅ Review task packs before running them (they have full browser access)  
✅ Restrict `--packs` directories to trusted sources only  

#### DON'T:
❌ Expose the dashboard to the internet without a reverse proxy and authentication  
❌ Run task packs from untrusted sources  
❌ Use `--host 0.0.0.0` on untrusted networks  
❌ Store sensitive credentials in task pack code (use secrets management instead)  
❌ Run the dashboard with elevated privileges (root/administrator)  

### Secrets Management

The dashboard provides a secrets resolution system for task packs:

````json
// In flow.json
{
  "flow": [
    {
      "type": "set_var",
      "name": "apiKey",
      "value": "{{secret:MY_API_KEY}}"
    }
  ]
}
````

**How secrets work:**
1. Task pack declares secret keys in `taskpack.json` metadata
2. Dashboard prompts user via UI when secret is needed
3. Secret is stored in the database (unencrypted SQLite file)
4. Template variables like `{{secret:KEY}}` are resolved at runtime

**⚠️ Security considerations:**
- Secrets are stored in plaintext in `./data/dashboard.db`
- Database file permissions rely on filesystem security
- Secrets are accessible to any task pack that declares them
- No encryption at rest or in transit

**Best practices for secrets:**
- Use environment variables or `config.json` for sensitive API keys
- Limit secret scope to specific task packs when possible
- Regularly rotate secrets and clear old values from database
- Never commit the `./data` directory to version control

---

## Troubleshooting

### Common Issues

#### 1. "No system prompt found" Error

**Symptom:**
````
[Dashboard] ERROR: No system prompt found.
[Dashboard] Run `showrun config init` to set up configuration...
````

**Cause:** Teach Mode requires the `EXPLORATION_AGENT_SYSTEM_PROMPT.md` file but cannot find it.

**Solution:**

````bash
# Initialize configuration (copies system prompt to config directory)
showrun config init

# Or manually create the file in your project root
cp EXPLORATION_AGENT_SYSTEM_PROMPT.md ./
````

**Alternative:** Set the prompt inline via environment variable:

````bash
export TEACH_CHAT_SYSTEM_PROMPT="You are an exploration agent..."
showrun dashboard --packs ./taskpacks
````

---

#### 2. "LLM provider not available" Warning

**Symptom:**
````
[Dashboard] LLM provider not available (OPENAI_API_KEY not set)
````

**Cause:** Teach Mode requires an LLM API key (Anthropic or OpenAI) but none is configured.

**Solution:**

Set API key via environment variable:
````bash
export ANTHROPIC_API_KEY="sk-ant-..."
showrun dashboard --packs ./taskpacks
````

Or via `config.json`:
````bash
showrun config init
# Edit .showrun/config.json:
{
  "llm": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  }
}
````

**Note:** Teach Mode will not function without a valid API key. Regular task pack execution works fine.

---

#### 3. "Authentication failed" on Socket.IO Connection

**Symptom:**
- Browser console shows: `Error: Authentication failed`
- Dashboard UI doesn't load or update in real-time

**Cause:** Frontend is using wrong/missing session token.

**Solution:**

1. **Check browser console:** Look for network errors on `/api/config`
2. **Verify token is returned:** Visit `http://localhost:3333/api/config` manually
3. **Clear browser cache/localStorage:** Old tokens may be cached
4. **Restart dashboard server:** Generates a new token

**Debug steps:**
````bash
# Check if server is running
curl http://localhost:3333/api/config

# Expected response:
{"token":"a1b2c3d4...","headful":false,...}
````

---

#### 4. "No task packs found" Warning

**Symptom:**
````
[Dashboard] Found 0 task pack(s)
[Dashboard] No task packs found.
````

**Cause:** 
- `--packs` directory doesn't exist
- Directory exists but contains no valid task packs
- Task pack structure is invalid

**Solution:**

1. **Verify directory exists:**
````bash
ls -la ./taskpacks
````

2. **Check pack structure:**
````
taskpacks/
└── my-pack/
    ├── taskpack.json  # Must exist with valid metadata
    └── flow.json      # Must exist for json-dsl packs
````

3. **Validate pack manually:**
````bash
showrun pack validate --path ./taskpacks/my-pack
````

4. **Create a new pack:**
````bash
showrun pack create --dir ./taskpacks --id test-pack --name "Test Pack"
````

---

#### 5. Port Already in Use

**Symptom:**
````
Error: listen EADDRINUSE: address already in use :::3333
````

**Cause:** Another process is using port 3333.

**Solution:**

Use a different port:
````bash
showrun dashboard --packs ./taskpacks --port 4444
````

Or find and stop the conflicting process:
````bash
# On macOS/Linux:
lsof -ti:3333 | xargs kill

# On Windows:
netstat -ano | findstr :3333
taskkill /PID <PID> /F
````

---

#### 6. Browser Automation Fails (Camoufox Missing)

**Symptom:**
- Task pack runs fail with "browser not found" or similar errors
- No browser window appears even with `--headful`

**Cause:** Camoufox browser binaries are not installed.

**Solution:**

````bash
# Download Camoufox browser
npx camoufox-js fetch

# Or specify custom browser path
export CAMOUFOX_BROWSER_PATH=/path/to/camoufox
showrun dashboard --packs ./taskpacks
````

---

#### 7. Teach Mode Not Responding / Slow

**Symptom:**
- AI agent takes very long to respond
- Messages sent but no reply
- UI shows "Agent is thinking..." indefinitely

**Common causes:**

**a) LLM API rate limits or quota exceeded**
````bash
# Check API key validity
curl https://api.anthropic.com/v1/messages \
  -H "anthropic-version: 2023-06-01" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
````

**b) Context size exceeded**

Teach Mode automatically summarizes conversations when context grows too large. If summarization fails:
- Check dashboard logs for `[ContextManager] Summarization failed` errors
- Restart conversation to clear context
- Use shorter, more focused prompts

**c) Network issues**

Verify connectivity to LLM API endpoints:
````bash
ping api.anthropic.com
# or
ping api.openai.com
````

---

#### 8. CORS Errors in Browser Console

**Symptom:**
````
Access to fetch at 'http://localhost:3333/api/runs' from origin 'http://127.0.0.1:3333' has been blocked by CORS policy
````

**Cause:** Browser treats `localhost` and `127.0.0.1` as different origins.

**Solution:**

Use consistent hostnames:
````bash
# Start dashboard
showrun dashboard --packs ./taskpacks --host 127.0.0.1

# Access via the same hostname
http://127.0.0.1:3333
````

Or configure browser to allow:
- Chrome: Launch with `--disable-web-security` flag (development only!)
- Firefox: Set `security.fileuri.strict_origin_policy = false` in about:config

**Note:** CORS restrictions will be tightened in future releases. See [PR #42](https://github.com/eyupulker/showrun/pull/42).

---

#### 9. Database Locked Errors

**Symptom:**
````
Error: SQLITE_BUSY: database is locked
````

**Cause:** Multiple dashboard instances or processes accessing the same database.

**Solution:**

1. **Stop all dashboard instances:**
````bash
# Find running processes
ps aux | grep "showrun dashboard"

# Kill them
kill <PID>
````

2. **Remove lock file (if stale):**
````bash
rm ./data/dashboard.db-wal
rm ./data/dashboard.db-shm
````

3. **Use separate data directories for concurrent instances:**
````bash
showrun dashboard --packs ./packs1 --data-dir ./data1 --port 3333
showrun dashboard --packs ./packs2 --data-dir ./data2 --port 4444
````

---

#### 10. Frontend Not Updating / Stale UI

**Symptom:**
- Run status not updating in real-time
- New runs don't appear in list
- Teach Mode messages don't show

**Cause:** Socket.IO connection lost or not established.

**Solution:**

1. **Check browser console** for Socket.IO errors
2. **Verify WebSocket connection:**
   - Open browser DevTools → Network tab
   - Look for WebSocket connection to `/socket.io/`
   - Should show "101 Switching Protocols"
3. **Check firewall rules:** Some corporate firewalls block WebSocket
4. **Restart dashboard server**

**Verify Socket.IO manually:**
````javascript
// In browser console:
console.log(window.socket?.connected);
// Should return: true
````

---

### Debug Mode

Enable detailed logging for troubleshooting:

````bash
showrun dashboard --packs ./taskpacks --debug
````

**What debug mode logs:**
- Failed tool calls (saved to `./data/failed-tool-calls.jsonl`)
- Browser inspector state changes
- MCP tool invocations
- Network request capture/replay operations

**Additional logging options:**

````bash
# Enable full conversation transcript logging
showrun dashboard --packs ./taskpacks --transcript-logging

# Enable both debug and transcript logging
showrun dashboard --packs ./taskpacks --debug --transcript-logging
````

**Log locations:**
- Dashboard server logs: `stdout` (console)
- Failed tool calls: `./data/failed-tool-calls.jsonl`
- Run events: `./runs-dashboard/<runId>/events.jsonl`
- Conversation transcripts: Database (`conversations` table)

---

### Getting Help

If you encounter issues not covered here:

1. **Check GitHub Issues:** [github.com/eyupulker/showrun/issues](https://github.com/eyupulker/showrun/issues)
2. **Enable debug logging:** Run with `--debug` flag and share logs
3. **Provide reproduction steps:** Minimal example that triggers the issue
4. **Check versions:** Run `showrun --version` and `node --version`

**When reporting bugs, include:**
- Dashboard version (`showrun --version`)
- Node.js version (`node --version`)
- Operating system
- Command used to start dashboard
- Relevant log output (with secrets redacted)
- Browser console errors (if UI-related)

---

## Performance Considerations

### Database Growth

The dashboard database (`./data/dashboard.db`) grows over time:

**What's stored:**
- Conversation history (Teach Mode)
- Agent context and plans
- Failed tool calls (if debug mode enabled)
- User-provided secrets

**Maintenance:**

````bash
# Check database size
ls -lh ./data/dashboard.db

# Clear old conversations (manual)
sqlite3 ./data/dashboard.db "DELETE FROM conversations WHERE created_at < datetime('now', '-30 days');"

# Vacuum database to reclaim space
sqlite3 ./data/dashboard.db "VACUUM;"
````

**Planned feature:** Automatic cleanup/archival of old data ([see roadmap](https://github.com/eyupulker/showrun/discussions/86)).

---

### Memory Usage

Teach Mode agents can consume significant memory during:
- Context summarization (processes entire conversation history)
- Large DOM snapshots (complex web pages)
- Network request replay with large response bodies

**Tips to reduce memory usage:**
- Restart dashboard periodically for long-running sessions
- Use targeted browser tools (e.g., `browser_get_links`) instead of `browser_screenshot`
- Clear network buffer with `browser_network_clear` after capturing requests
- Use smaller LLM context windows (configure via model selection)

---

### Concurrency

By default, the dashboard runs **one task pack at a time** (concurrency limit: 1).

**To change concurrency:**

Currently hardcoded in `server.ts`:
````typescript
const concurrencyLimiter = new ConcurrencyLimiter(1);
````

**Planned feature:** CLI flag for configurable concurrency ([see roadmap](https://github.com/eyupulker/showrun/discussions/86)).

**Why limit concurrency?**
- Browser automation is resource-intensive (CPU, memory, network)
- Multiple headful browsers can overwhelm desktop environments
- Prevents accidental DoS of target websites

---

## Related Documentation

- **Configuration Guide:** [Main README - Configuration](../../README.md#configuration)
- **Task Pack Authoring:** [Core Package README](../core/README.md)
- **MCP Server:** [MCP Server README](../mcp-server/README.md)
- **CLI Reference:** Run `showrun --help` or `showrun dashboard --help`

---

*This guide is maintained as part of the ShowRun project. Contributions and corrections are welcome via pull requests.*
