
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import request from 'supertest';
import { Server as SocketIOServer } from 'socket.io';
import type { AddressInfo } from 'net';

describe('CORS Configuration', () => {
  let app: express.Express;
  let server: ReturnType<typeof createServer>;
  let port: number;
  let host = '127.0.0.1';

  beforeAll(async () => {
    app = express();
    server = createServer(app);

    // Bind to random ephemeral port
    await new Promise<void>((resolve) => {
      server.listen(0, host, () => {
        resolve();
      });
    });

    const address = server.address() as AddressInfo;
    port = address.port;

    // Allowed origins dynamically constructed with the assigned port
    const allowedOrigins = [
      `http://${host}:${port}`,
      `http://localhost:${port}`,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

    // Configure app with these origins
    app.use(cors({ origin: allowedOrigins }));
    app.use(express.json());

    // Test endpoint
    app.get('/api/config', (req, res) => {
      res.json({ token: 'secret-token' });
    });

    // Setup Socket.IO with the same origins
    new SocketIOServer(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
      },
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should allow requests from localhost on the bound port', async () => {
    const origin = `http://localhost:${port}`;
    const response = await request(app)
      .get('/api/config')
      .set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('should allow requests from 127.0.0.1 on the bound port', async () => {
    const origin = `http://${host}:${port}`;
    const response = await request(app)
      .get('/api/config')
      .set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('should allow requests from the Vite dev server (localhost:5173)', async () => {
    const origin = 'http://localhost:5173';
    const response = await request(app)
      .get('/api/config')
      .set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('should NOT return Access-Control-Allow-Origin header for untrusted origins', async () => {
    const origin = 'http://evil-site.com';
    const response = await request(app)
      .get('/api/config')
      .set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should NOT return Access-Control-Allow-Origin header for random port on localhost', async () => {
    // Pick a port that is definitely different from the one we bound
    const otherPort = port === 9999 ? 9998 : 9999;
    const origin = `http://localhost:${otherPort}`;
    const response = await request(app)
      .get('/api/config')
      .set('Origin', origin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
