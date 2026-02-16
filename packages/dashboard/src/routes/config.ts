import { resolve } from 'node:path';
import { TaskPackLoader } from '@showrun/core';
import { discoverPacks } from '@showrun/mcp-server';
import { type Request, type Response, Router } from 'express';
import type { DashboardContext } from '../types/context.js';

export function createConfigRouter(ctx: DashboardContext): Router {
  const router = Router();

  // REST API: Get config (includes session token)
  router.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      token: ctx.sessionToken,
      packsCount: ctx.packMap.size,
    });
  });

  // REST API: List packs
  router.get('/api/packs', async (_req: Request, res: Response) => {
    // Reload packs to get latest state
    const currentPacks = await discoverPacks({ directories: ctx.packDirs });

    // Update pack map
    ctx.packMap.clear();
    for (const { pack, path } of currentPacks) {
      ctx.packMap.set(pack.metadata.id, { pack, path });
    }

    const packsList = currentPacks.map(({ pack, path }) => {
      // Check if it's a JSON-DSL pack
      let kind: string | undefined;
      try {
        const manifest = TaskPackLoader.loadManifest(path);
        kind = manifest.kind;
      } catch {
        // Ignore errors
      }

      return {
        id: pack.metadata.id,
        name: pack.metadata.name,
        version: pack.metadata.version,
        description: pack.metadata.description || '',
        inputs: pack.inputs,
        collectibles: pack.collectibles,
        path,
        kind,
      };
    });
    res.json(packsList);
  });

  // REST API: Get system info for MCP config generation
  router.get('/api/system-info', (_req: Request, res: Response) => {
    // Detect whether showrun was launched via npx / global install or directly via node
    const isNpx = Boolean(
      process.env.npm_execpath || // running under npm/npx/pnpm
        process.env.npm_lifecycle_event
    );

    // process.argv[1] is the actual entry script that Node is running
    const cliPath = process.argv[1] ? resolve(process.argv[1]) : '';

    res.json({
      nodePath: process.execPath,
      cliPath,
      useNpx: isNpx,
    });
  });

  return router;
}
