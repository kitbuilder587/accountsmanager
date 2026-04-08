import { useEffect, useState } from 'react';
import type { Reel } from '../../shared/reel.js';
import * as api from '../api.js';

interface ReelsListProps {
  onSelectReel: (reel: Reel) => void;
  selectedReelId: string | null;
  refreshKey: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  downloading: 'Downloading...',
  ocr: 'Detecting text...',
  generating: 'Generating text...',
  rendering: 'Rendering...',
  ready: 'Ready',
  publishing: 'Publishing...',
  published: 'Published',
  error: 'Error',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  downloading: '#2563eb',
  ocr: '#2563eb',
  generating: '#2563eb',
  rendering: '#2563eb',
  ready: '#059669',
  publishing: '#d97706',
  published: '#059669',
  error: '#dc2626',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="status-badge"
      style={{ backgroundColor: `${STATUS_COLORS[status] || '#6b7280'}20`, color: STATUS_COLORS[status] || '#6b7280' }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function ReelsList({ onSelectReel, selectedReelId, refreshKey }: ReelsListProps) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const status = filterStatus || undefined;
        const response = await api.listReels(status);
        if (!cancelled) setReels(response.reels);
      } catch (error) {
        console.error('Failed to load reels:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [filterStatus, refreshKey]);

  // Auto-refresh for processing reels
  useEffect(() => {
    const timer = setInterval(async () => {
      // Check current reels inside the callback to avoid dependency on reels
      setReels(currentReels => {
        const hasProcessing = currentReels.some(r =>
          ['downloading', 'ocr', 'generating', 'rendering', 'publishing'].includes(r.status)
        );
        if (hasProcessing) {
          api.listReels(filterStatus || undefined)
            .then(response => setReels(response.reels))
            .catch(() => { /* ignore */ });
        }
        return currentReels;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [filterStatus]);

  return (
    <section className="panel panel--list">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Reels pipeline</p>
          <h2>Reel Registry</h2>
        </div>
        <select
          className="status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="ready">Ready</option>
          <option value="published">Published</option>
          <option value="error">Error</option>
        </select>
      </div>

      {isLoading ? <p className="panel-message">Loading reels...</p> : null}

      {!isLoading && reels.length === 0 ? (
        <div className="empty-state">
          <h2>No reels yet</h2>
          <p>
            Send an Instagram Reel link to the Telegram bot or add one manually
            to start the repackaging pipeline.
          </p>
        </div>
      ) : null}

      {!isLoading && reels.length > 0 ? (
        <div className="profile-list" role="list" aria-label="Reels">
          {reels.map((reel) => (
            <button
              key={reel.id}
              type="button"
              className={reel.id === selectedReelId ? 'profile-row profile-row--selected' : 'profile-row'}
              onClick={() => onSelectReel(reel)}
            >
              <div className="profile-row__header">
                <span className="profile-row__label reel-url-label">
                  {reel.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                </span>
                <StatusBadge status={reel.status} />
              </div>
              <p className="profile-row__note">
                {reel.finalText || reel.originalText || 'No text detected yet'}
              </p>
              <p className="profile-row__timestamp">
                {new Date(reel.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
