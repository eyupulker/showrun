import React, { useState, useEffect } from 'react';

interface Pack {
  id: string;
  name: string;
  version: string;
  description: string;
}

interface MCPServerViewProps {
  packs: Pack[];
  token: string;
}

interface MCPStatus {
  running: boolean;
  url?: string;
  port?: number;
  packIds?: string[];
}

function MCPServerView({ packs, token }: MCPServerViewProps) {
  const [status, setStatus] = useState<MCPStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [port, setPort] = useState<number>(3340);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/mcp/status');
      if (res.ok) {
        const data = (await res.json()) as MCPStatus;
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch MCP status', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStart = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one task pack');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCPIFY-TOKEN': token,
        },
        body: JSON.stringify({
          packIds: Array.from(selectedIds),
          port: port > 0 ? port : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to start MCP server');
      }
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCPIFY-TOKEN': token,
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || data.details || 'Failed to stop MCP server');
      }
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const togglePack = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(packs.map((p) => p.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  return (
    <div>
      <div className="card">
        <h2>MCP Server (HTTP/SSE)</h2>
        <p style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
          Start an MCP server with selected task packs. Clients connect via Streamable HTTP (POST/GET) or SSE.
        </p>

        {error && <div className="error">{error}</div>}

        {status?.running ? (
          <div>
            <div style={{ marginBottom: '12px', padding: '12px', background: '#e8f5e9', borderRadius: '8px' }}>
              <strong>Server running</strong>
              <div style={{ marginTop: '8px' }}>
                <strong>URL:</strong>{' '}
                <a href={status.url} target="_blank" rel="noopener noreferrer">
                  {status.url}
                </a>
              </div>
              <div style={{ marginTop: '4px' }}>
                <strong>Packs:</strong> {(status.packIds ?? []).join(', ')}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#555' }}>
                Server is ready. Send MCP requests directly to this URL - no session headers required.
              </div>
            </div>
            <button onClick={handleStop} disabled={loading}>
              {loading ? 'Stopping...' : 'Stop MCP server'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <label>
                <strong>Port:</strong>{' '}
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value, 10) || 3340)}
                  style={{ width: '80px', padding: '4px 8px' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>Task packs to expose as tools:</strong>
              <div style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{ marginRight: '8px', padding: '4px 10px', fontSize: '12px' }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Select none
                </button>
              </div>
            </div>
            <div className="pack-list" style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '16px' }}>
              {packs.length === 0 ? (
                <div className="loading">No task packs available</div>
              ) : (
                packs.map((pack) => (
                  <label
                    key={pack.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 0',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pack.id)}
                      onChange={() => togglePack(pack.id)}
                    />
                    <span style={{ fontWeight: 500 }}>{pack.name}</span>
                    <span className="meta" style={{ color: '#888', fontSize: '12px' }}>
                      {pack.id} • v{pack.version}
                    </span>
                  </label>
                ))
              )}
            </div>
            <button onClick={handleStart} disabled={loading || selectedIds.size === 0}>
              {loading ? 'Starting...' : 'Start MCP server'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MCPServerView;
