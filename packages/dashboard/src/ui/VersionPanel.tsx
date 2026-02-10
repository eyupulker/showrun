import React, { useState, useEffect } from 'react';

interface FlowVersion {
  number: number;
  version: string;
  timestamp: string;
  label?: string;
  source: 'agent' | 'cli' | 'dashboard';
  conversationId?: string;
}

interface VersionPanelProps {
  packId: string;
  token: string;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function VersionPanel({ packId, token }: VersionPanelProps) {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [showLabelInput, setShowLabelInput] = useState(false);

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-showrun-token': token,
        ...options.headers,
      },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return response.json();
  };

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall(`/api/packs/${encodeURIComponent(packId)}/versions`);
      setVersions(data.versions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [packId]);

  const handleSaveSnapshot = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiCall(`/api/packs/${encodeURIComponent(packId)}/versions`, {
        method: 'POST',
        body: JSON.stringify({ label: snapshotLabel || undefined }),
      });
      setSnapshotLabel('');
      setShowLabelInput(false);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    setRestoring(versionNumber);
    setError(null);
    try {
      await apiCall(`/api/packs/${encodeURIComponent(packId)}/versions/${versionNumber}/restore`, {
        method: 'POST',
      });
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(null);
    }
  };

  const sortedVersions = [...versions].reverse(); // newest first

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>Versions</span>
        <button
          className="btn-secondary"
          style={{ padding: '4px 12px', fontSize: '12px' }}
          onClick={() => setShowLabelInput(!showLabelInput)}
          disabled={saving}
        >
          Save Snapshot
        </button>
      </div>

      {showLabelInput && (
        <div style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '12px',
        }}>
          <input
            type="text"
            placeholder="Label (optional)"
            value={snapshotLabel}
            onChange={(e) => setSnapshotLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSnapshot(); }}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          />
          <button
            className="btn-primary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={handleSaveSnapshot}
            disabled={saving}
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '8px',
          marginBottom: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '4px',
          color: 'var(--accent-red)',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            Loading...
          </div>
        )}

        {!loading && sortedVersions.length === 0 && (
          <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            No versions saved yet.
            <div style={{ marginTop: '4px', fontSize: '11px' }}>
              Versions are auto-saved when a flow is marked as ready.
            </div>
          </div>
        )}

        {sortedVersions.map((v) => (
          <div
            key={v.number}
            style={{
              padding: '8px 10px',
              marginBottom: '4px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                  v{v.version}
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  backgroundColor: v.source === 'agent' ? 'rgba(255, 103, 26, 0.15)' :
                                   v.source === 'cli' ? 'rgba(59, 130, 246, 0.15)' :
                                   'rgba(34, 197, 94, 0.15)',
                  color: v.source === 'agent' ? 'var(--brand-300)' :
                         v.source === 'cli' ? 'var(--accent-blue)' :
                         'var(--accent-green)',
                }}>
                  {v.source}
                </span>
              </div>
              <button
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '11px' }}
                onClick={() => handleRestore(v.number)}
                disabled={restoring === v.number}
              >
                {restoring === v.number ? '...' : 'Restore'}
              </button>
            </div>
            {v.label && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                {v.label}
              </div>
            )}
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              #{v.number} &middot; {timeAgo(v.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
