import React, { useState, useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import PacksView from './PacksView.js';
import RunsView from './RunsView.js';
import MCPServerView from './MCPServerView.js';

interface Pack {
  id: string;
  name: string;
  version: string;
  description: string;
  inputs: Record<string, any>;
  collectibles: Array<{ name: string; type: string; description?: string }>;
  path: string;
}

interface Run {
  runId: string;
  packId: string;
  packName: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  runDir?: string;
  eventsPath?: string;
  artifactsDir?: string;
  collectibles?: Record<string, unknown>;
  meta?: {
    url?: string;
    durationMs: number;
    notes?: string;
  };
  error?: string;
}

interface Config {
  token: string;
  packsCount: number;
}

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeTab, setActiveTab] = useState<'packs' | 'runs' | 'mcp'>('packs');
  const [error, setError] = useState<string | null>(null);

  // Fetch config and initialize socket
  useEffect(() => {
    async function init() {
      try {
        const configRes = await fetch('/api/config');
        if (!configRes.ok) {
          throw new Error('Failed to fetch config');
        }
        const configData = await configRes.json() as Config;
        setConfig(configData);

        // Initialize socket with token
        const newSocket = io({
          auth: {
            token: configData.token,
          },
        });

        newSocket.on('connect', () => {
          console.log('Socket connected');
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        newSocket.on('runs:list', (runsList: Run[]) => {
          setRuns(runsList);
        });

        newSocket.on('packs:updated', () => {
          // Reload packs when updated
          fetch('/api/packs')
            .then((res) => res.json())
            .then((data) => setPacks(data as Pack[]))
            .catch(console.error);
        });

        setSocket(newSocket);

        // Fetch packs
        const packsRes = await fetch('/api/packs');
        if (!packsRes.ok) {
          throw new Error('Failed to fetch packs');
        }
        const packsData: Pack[] = await packsRes.json();
        setPacks(packsData);

        // Fetch runs
        const runsRes = await fetch('/api/runs');
        if (!runsRes.ok) {
          throw new Error('Failed to fetch runs');
        }
        const runsData = await runsRes.json() as Run[];
        setRuns(runsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    init();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!config || !socket) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>MCPify Dashboard</h1>
        <p>Run and observe Task Packs in real time</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'packs' ? 'active' : ''}`}
          onClick={() => setActiveTab('packs')}
        >
          Task Packs ({packs.length})
        </button>
        <button
          className={`tab ${activeTab === 'runs' ? 'active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          Runs ({runs.length})
        </button>
        <button
          className={`tab ${activeTab === 'mcp' ? 'active' : ''}`}
          onClick={() => setActiveTab('mcp')}
        >
          MCP Server
        </button>
      </div>

      {activeTab === 'packs' && (
        <PacksView
          packs={packs}
          socket={socket}
          token={config.token}
          onRun={(packId) => {
            setActiveTab('runs');
            // The run will appear in the runs list automatically
          }}
        />
      )}
      {activeTab === 'runs' && <RunsView runs={runs} socket={socket} />}
      {activeTab === 'mcp' && <MCPServerView packs={packs} token={config.token} />}
    </div>
  );
}

export default App;
