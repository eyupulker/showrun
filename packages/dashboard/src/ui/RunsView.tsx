import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { FixedSizeList as List } from 'react-window';

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
  conversationId?: string;
  source?: 'dashboard' | 'mcp' | 'cli' | 'agent';
}

interface RunEvent {
  timestamp: string;
  type: string;
  data: any;
}

interface RunsViewProps {
  runs: Run[];
  socket: Socket;
}

const RunItem = React.memo(({ run, isSelected, onClick, formatDate, formatDuration, getSourceLabel }: {
  run: Run;
  isSelected: boolean;
  onClick: () => void;
  formatDate: (ts: number) => string;
  formatDuration: (ms?: number) => string;
  getSourceLabel: (source?: string) => string;
}) => (
  <div
    className={`run-item ${isSelected ? 'selected' : ''}`}
    onClick={onClick}
    style={{ marginBottom: '12px' }}
  >
    <div className="run-item-header">
      <h3>{run.packName}</h3>
      <span className={`status-badge ${run.status}`}>{run.status}</span>
    </div>
    <div className="run-item-meta">
      <span>{formatDate(run.createdAt)}</span>
      <span style={{ margin: '0 8px' }}>|</span>
      <span>{formatDuration(run.durationMs)}</span>
      {run.source && (
        <>
          <span style={{ margin: '0 8px' }}>|</span>
          <span style={{ color: 'var(--accent-orange)' }}>{getSourceLabel(run.source)}</span>
        </>
      )}
    </div>
  </div>
));

function RunsView({ runs, socket }: RunsViewProps) {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  useEffect(() => {
    if (!selectedRun) {
      setEvents([]);
      return;
    }

    const eventChannel = `runs:events:${selectedRun.runId}`;
    socket.on(eventChannel, (event: RunEvent) => {
      setEvents((prev) => [...prev, event]);
    });

    return () => {
      socket.off(eventChannel);
    };
  }, [selectedRun, socket]);

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  const formatDuration = useCallback((ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }, []);

  const getSourceLabel = useCallback((source?: string) => {
    switch (source) {
      case 'dashboard':
        return 'Dashboard';
      case 'mcp':
        return 'MCP';
      case 'cli':
        return 'CLI';
      case 'agent':
        return 'Agent';
      default:
        return 'Unknown';
    }
  }, []);

  // Filter runs by source
  const filteredRuns = useMemo(() =>
    sourceFilter === 'all' ? runs : runs.filter((r) => r.source === sourceFilter),
    [runs, sourceFilter]
  );

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Run History</h2>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{ padding: '8px 12px', minWidth: '120px' }}
          >
            <option value="all">All Sources</option>
            <option value="dashboard">Dashboard</option>
            <option value="mcp">MCP</option>
            <option value="cli">CLI</option>
            <option value="agent">Agent</option>
          </select>
        </div>

        <div className="runs-list" style={{ height: '400px' }}>
          {filteredRuns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No runs yet</div>
              <div className="empty-state-description">
                Runs will appear here when you execute task packs.
              </div>
            </div>
          ) : (
            <List
              height={400}
              itemCount={filteredRuns.length}
              itemSize={90}
              width="100%"
            >
              {({ index, style }) => (
                <div style={style}>
                  <RunItem
                    run={filteredRuns[index]}
                    isSelected={selectedRun?.runId === filteredRuns[index].runId}
                    onClick={() => setSelectedRun(filteredRuns[index])}
                    formatDate={formatDate}
                    formatDuration={formatDuration}
                    getSourceLabel={getSourceLabel}
                  />
                </div>
              )}
            </List>
          )}
        </div>
      </div>

      {selectedRun && (
        <div className="card run-detail">
          <h2>Run Details: {selectedRun.packName}</h2>

          <div className="run-detail-section">
            <h3>Status</h3>
            <div className="run-detail-info">
              <p>
                <strong>Status:</strong>{' '}
                <span className={`status-badge ${selectedRun.status}`}>{selectedRun.status}</span>
              </p>
              <p>
                <strong>Source:</strong> {getSourceLabel(selectedRun.source)}
              </p>
              <p>
                <strong>Created:</strong> {formatDate(selectedRun.createdAt)}
              </p>
              {selectedRun.startedAt && (
                <p>
                  <strong>Started:</strong> {formatDate(selectedRun.startedAt)}
                </p>
              )}
              {selectedRun.finishedAt && (
                <p>
                  <strong>Finished:</strong> {formatDate(selectedRun.finishedAt)}
                </p>
              )}
              <p>
                <strong>Duration:</strong> {formatDuration(selectedRun.durationMs)}
              </p>
              {selectedRun.error && (
                <p>
                  <strong>Error:</strong> <code>{selectedRun.error}</code>
                </p>
              )}
            </div>
          </div>

          {selectedRun.meta && (
            <div className="run-detail-section">
              <h3>Metadata</h3>
              <div className="run-detail-info">
                {selectedRun.meta.url && (
                  <p>
                    <strong>URL:</strong> <code>{selectedRun.meta.url}</code>
                  </p>
                )}
                {selectedRun.meta.notes && (
                  <p>
                    <strong>Notes:</strong> {selectedRun.meta.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {selectedRun.collectibles && Object.keys(selectedRun.collectibles).length > 0 && (
            <div className="run-detail-section">
              <h3>Collectibles</h3>
              <div className="run-detail-info">
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {JSON.stringify(selectedRun.collectibles, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {(selectedRun.runDir || selectedRun.eventsPath || selectedRun.artifactsDir) && (
            <div className="run-detail-section">
              <h3>Paths</h3>
              <div className="run-detail-info">
                {selectedRun.runDir && (
                  <p>
                    <strong>Run Directory:</strong> <code>{selectedRun.runDir}</code>
                  </p>
                )}
                {selectedRun.eventsPath && (
                  <p>
                    <strong>Events:</strong> <code>{selectedRun.eventsPath}</code>
                  </p>
                )}
                {selectedRun.artifactsDir && (
                  <p>
                    <strong>Artifacts:</strong> <code>{selectedRun.artifactsDir}</code>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="run-detail-section">
            <h3>Live Events</h3>
            <div className="events-stream" style={{ height: '400px', padding: 0 }}>
              {events.length === 0 ? (
                <div className="event-line info" style={{ padding: '16px' }}>
                  {selectedRun.status === 'running'
                    ? 'Waiting for events...'
                    : 'No events captured'}
                </div>
              ) : (
                <List
                  height={400}
                  itemCount={events.length}
                  itemSize={25}
                  width="100%"
                >
                  {({ index, style }) => {
                    const event = events[index];
                    return (
                      <div
                        style={style}
                        className={`event-line ${
                          event.type === 'error'
                            ? 'error'
                            : event.type === 'run_finished' && event.data.success
                            ? 'success'
                            : 'info'
                        }`}
                      >
                        <div style={{ padding: '0 16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          [{event.timestamp}] {event.type}: {JSON.stringify(event.data)}
                        </div>
                      </div>
                    );
                  }}
                </List>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RunsView;
