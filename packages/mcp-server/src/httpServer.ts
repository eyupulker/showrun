import { createServer } from 'http';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { TaskPack, InputSchema } from '@mcpify/core';
import { runTaskPack } from '@mcpify/core';
import { JSONLLogger } from '@mcpify/harness/dist/index.js';
import type { DiscoveredPack } from './packDiscovery.js';
import { ConcurrencyLimiter } from './concurrency.js';

export interface MCPServerHTTPOptions {
  packs: DiscoveredPack[];
  baseRunDir: string;
  concurrency: number;
  headful: boolean;
  port: number;
  host?: string;
}

function inputSchemaToZodSchema(inputs: InputSchema): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  for (const [fieldName, fieldDef] of Object.entries(inputs)) {
    let zodType: z.ZodTypeAny;
    switch (fieldDef.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      default:
        zodType = z.string();
    }
    if (fieldDef.description) zodType = zodType.describe(fieldDef.description);
    if (!fieldDef.required) zodType = zodType.optional();
    shape[fieldName] = zodType;
  }
  return shape;
}

export interface MCPServerHTTPHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Creates and starts the MCP server with Streamable HTTP (HTTPS/SSE) transport.
 * Returns handle with port, url, and close() to stop the server.
 */
export async function createMCPServerOverHTTP(
  options: MCPServerHTTPOptions
): Promise<MCPServerHTTPHandle> {
  const { packs, baseRunDir, concurrency, headful, port, host = '127.0.0.1' } = options;

  mkdirSync(baseRunDir, { recursive: true });
  const limiter = new ConcurrencyLimiter(concurrency);

  const mcpServer = new McpServer({
    name: 'taskpack-mcp-server',
    version: '0.1.0',
  });

  for (const { pack, toolName } of packs) {
    const inputSchema = inputSchemaToZodSchema(pack.inputs);
    mcpServer.registerTool(
      toolName,
      {
        title: pack.metadata.name,
        description: `${pack.metadata.description || pack.metadata.name} (v${pack.metadata.version})`,
        inputSchema,
      },
      async (inputs: Record<string, unknown>) => {
        const runId = randomUUID();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const runDir = join(baseRunDir, `${toolName}-${timestamp}-${runId.slice(0, 8)}`);
        return await limiter.execute(async () => {
          const logger = new JSONLLogger(runDir);
          try {
            const runResult = await runTaskPack(pack, inputs, {
              runDir,
              logger,
              headless: !headful,
            });
            const output = {
              taskId: pack.metadata.id,
              version: pack.metadata.version,
              runId,
              meta: runResult.meta,
              collectibles: runResult.collectibles,
              runDir: runResult.runDir,
              eventsPath: runResult.eventsPath,
              artifactsDir: runResult.artifactsDir,
            };
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
              structuredContent: output,
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorOutput = {
              taskId: pack.metadata.id,
              version: pack.metadata.version,
              runId,
              error: errorMessage,
              meta: { durationMs: 0, notes: `Error: ${errorMessage}` },
              collectibles: {},
              runDir,
              eventsPath: join(runDir, 'events.jsonl'),
              artifactsDir: join(runDir, 'artifacts'),
            };
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(errorOutput, null, 2) }],
              structuredContent: errorOutput,
            };
          }
        });
      }
    );
  }

  // Generate default session ID - all requests will use this unless client provides their own
  const defaultSessionId = randomUUID();
  
  // Use stateful mode with session management
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => defaultSessionId, // Return the default session ID
  });
  // connect() calls transport.start() internally; do not call start() here or we get "Transport already started"
  await mcpServer.connect(transport);

  const httpServer = createServer(async (req, res) => {
    try {
      // If client doesn't provide Mcp-Session-Id header, inject the default one
      // This allows all requests to use the same session by default
      // If client explicitly provides a session ID, use that instead
      if (!req.headers['mcp-session-id'] && !req.headers['Mcp-Session-Id']) {
        req.headers['mcp-session-id'] = defaultSessionId;
      }
      
      await transport.handleRequest(req, res);
    } catch (err) {
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
      resolve({
        port: actualPort,
        url,
        close: () =>
          new Promise<void>((closeResolve) => {
            httpServer.close(() => closeResolve());
          }),
      });
    });
  });
}
