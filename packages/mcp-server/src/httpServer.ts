import { createServer, IncomingMessage } from 'http';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ResultStoreProvider } from '@showrun/core';
import type { DiscoveredPack } from './packDiscovery.js';
import { ConcurrencyLimiter } from './concurrency.js';
import { registerPackTools } from './toolRegistration.js';
import type { MCPRunStartInfo, MCPRunCompleteInfo } from './toolRegistration.js';

export type { MCPRunStartInfo, MCPRunCompleteInfo } from './toolRegistration.js';

export interface MCPServerHTTPOptions {
  packs: DiscoveredPack[];
  baseRunDir: string;
  concurrency: number;
  headful: boolean;
  port: number;
  host?: string;
  /** Called when a run starts (for tracking/logging) */
  onRunStart?: (info: MCPRunStartInfo) => void;
  /** Called when a run completes (for tracking/logging) */
  onRunComplete?: (info: MCPRunCompleteInfo) => void;
  /**
   * Per-pack result stores, keyed by tool name.
   * When provided, results are auto-stored and query/list tools registered.
   */
  resultStores?: Map<string, ResultStoreProvider>;
}

interface ClientSession {
  id: string;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  createdAt: Date;
  lastAccessedAt: Date;
}

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Parse cookies from request header
 */
function parseCookies(req: IncomingMessage): Record<string, string> {
  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return cookies;

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name && valueParts.length > 0) {
      cookies[name.trim()] = valueParts.join('=').trim();
    }
  }
  return cookies;
}

export interface MCPServerHTTPHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Creates and starts the MCP server with Streamable HTTP (HTTPS/SSE) transport.
 * Returns handle with port, url, and close() to stop the server.
 *
 * Session Management:
 * - Each client gets their own isolated session
 * - Client can provide session ID via 'mcp-session-id' header to resume a session
 * - New session ID is generated if client doesn't provide one
 */
export async function createMCPServerOverHTTP(
  options: MCPServerHTTPOptions
): Promise<MCPServerHTTPHandle> {
  const { packs, baseRunDir, concurrency, headful, port, host = '127.0.0.1', onRunStart, onRunComplete, resultStores } = options;

  mkdirSync(baseRunDir, { recursive: true });
  const limiter = new ConcurrencyLimiter(concurrency);

  // Store sessions by client session ID
  const sessions = new Map<string, ClientSession>();

  /**
   * Create a new MCP server instance with all tools registered
   */
  function createMcpServerWithTools(clientSessionId: string): McpServer {
    const server = new McpServer({
      name: 'taskpack-mcp-server',
      version: '0.1.0',
    });

    registerPackTools(server, {
      packs,
      baseRunDir,
      limiter,
      headful,
      sessionId: clientSessionId,
      resultStores,
      onRunStart,
      onRunComplete,
    });

    return server;
  }

  /**
   * Get or create a session for the given session ID
   */
  async function getOrCreateSession(sessionId: string): Promise<ClientSession> {
    let session = sessions.get(sessionId);

    if (session) {
      session.lastAccessedAt = new Date();
      return session;
    }

    // Create new session
    const server = createMcpServerWithTools(sessionId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });

    await server.connect(transport);

    session = {
      id: sessionId,
      server,
      transport,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    sessions.set(sessionId, session);
    console.error(`[MCP Server] Created new session: ${sessionId}`);

    return session;
  }

  /**
   * Extract session ID from request headers or cookies
   */
  function getSessionIdFromRequest(req: IncomingMessage): string | undefined {
    // First check header (preferred for MCP clients)
    const headerSessionId = req.headers['mcp-session-id'];
    if (typeof headerSessionId === 'string' && headerSessionId.length > 0) {
      return headerSessionId;
    }

    // Fallback to cookie for simple HTTP clients
    const cookies = parseCookies(req);
    const cookieSessionId = cookies['mcp-session-id'];
    if (cookieSessionId && cookieSessionId.length > 0) {
      return cookieSessionId;
    }

    return undefined;
  }

  /**
   * Clean up inactive sessions
   */
  function cleanupInactiveSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of sessions) {
      const inactiveMs = now - session.lastAccessedAt.getTime();
      if (inactiveMs > SESSION_TIMEOUT_MS) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      sessions.delete(sessionId);
      console.error(`[MCP Server] Removed inactive session: ${sessionId} (inactive for ${Math.round(SESSION_TIMEOUT_MS / 60000)} minutes)`);
    }

    if (expiredSessions.length > 0) {
      console.error(`[MCP Server] Active sessions: ${sessions.size}`);
    }
  }

  // Start cleanup interval
  const cleanupInterval = setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL_MS);

  if (resultStores && resultStores.size > 0) {
    console.error(`[MCP Server] Result stores enabled for ${resultStores.size} pack(s)`);
  }

  const httpServer = createServer(async (req, res) => {
    try {
      // Get session ID from header or cookie, or generate new one
      let sessionId = getSessionIdFromRequest(req);
      const isNewSession = !sessionId;

      if (!sessionId) {
        sessionId = randomUUID();
      }

      // Inject session ID into headers for the transport
      req.headers['mcp-session-id'] = sessionId;

      const session = await getOrCreateSession(sessionId);

      // Set session ID in both header and cookie for client flexibility
      if (isNewSession) {
        res.setHeader('Mcp-Session-Id', sessionId);
      }
      // Always set/refresh the cookie
      res.setHeader('Set-Cookie', `mcp-session-id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TIMEOUT_MS / 1000)}`);

      await session.transport.handleRequest(req, res);
    } catch (err) {
      console.error('[MCP Server] Request error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  return new Promise<MCPServerHTTPHandle>((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(port, host, () => {
      const addr = httpServer.address();
      const actualPort = typeof addr === 'object' && addr !== null ? addr.port : port;
      const scheme = 'http';
      const url = `${scheme}://${host}:${actualPort}`;
      console.error(`[MCP Server] HTTP server listening on ${url}`);
      console.error(`[MCP Server] Session management enabled - each client gets isolated session`);
      resolve({
        port: actualPort,
        url,
        close: () =>
          new Promise<void>(async (closeResolve) => {
            clearInterval(cleanupInterval);
            // Close all result stores
            if (resultStores) {
              for (const [, store] of resultStores) {
                try { await store.close?.(); } catch { /* ignore */ }
              }
            }
            sessions.clear();
            httpServer.close(() => closeResolve());
          }),
      });
    });
  });
}
