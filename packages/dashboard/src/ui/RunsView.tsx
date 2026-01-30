import React, { useState, useEffect } from 'react';
import type { Socket } from 'socket.io-client';

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

interface RunEvent {
  timestamp: string;
  type: string;
  data: any;
}

interface RunsViewProps {
  runs: Run[];
  socket: Socket;
}

function RunsView({ runs, socket }: RunsViewProps) {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);

  useEffect(() => {
    if (!selectedRun) {
      setEvents([]);
      return;
    }

    // Listen for events for this run
    const eventChannel = `runs:events:${selectedRun.runId}`;
    socket.on(eventChannel, (event: RunEvent) => {
      setEvents((prev) => [...prev, event]);
    });

    // Load existing events from file if available
    if (selectedRun.eventsPath) {
      // Note: In a real implementation, you might want to fetch events from the server
      // For now, we'll only show live events
    }

    return () => {
      socket.off(eventChannel);
    };
  }, [selectedRun, socket]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div>
      <div className="card">
        <h2>Run History</h2>
        <div className="runs-list">
          {runs.length === 0 ? (
            <div className="loading">No runs yet</div>
          ) : (
            runs.map((run) => (
              <div
                key={run.runId}
                className={`run-item ${selectedRun?.runId === run.runId ? 'selected' : ''}`}
                onClick={() => setSelectedRun(run)}
              >
                <div className="run-item-header">
                  <h3>{run.packName}</h3>
                  <span className={`status-badge ${run.status}`}>
                    {run.status}
                  </span>
                </div>
                <div className="run-item-meta">
                  {formatDate(run.createdAt)} • {formatDuration(run.durationMs)}
                </div>
              </div>
            ))
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
                <span className={`status-badge ${selectedRun.status}`}>
                  {selectedRun.status}
                </span>
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
                <pre>{JSON.stringify(selectedRun.collectibles, null, 2)}</pre>
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
            <div className="events-stream">
              {events.length === 0 ? (
                <div className="event-line info">
                  {selectedRun.status === 'running'
                    ? 'Waiting for events...'
                    : 'No events captured'}
                </div>
              ) : (
                events.map((event, idx) => (
                  <div
                    key={idx}
                    className={`event-line ${
                      event.type === 'error'
                        ? 'error'
                        : event.type === 'run_finished' && event.data.success
                        ? 'success'
                        : 'info'
                    }`}
                  >
                    [{event.timestamp}] {event.type}: {JSON.stringify(event.data)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RunsView;
