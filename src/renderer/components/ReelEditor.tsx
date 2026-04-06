import { useState } from 'react';
import type { Reel } from '../../shared/reel.js';
import * as api from '../api.js';
import { VideoPlayer } from './VideoPlayer.js';
import { ReelPublishDialog } from './ReelPublishDialog.js';

interface ReelEditorProps {
  reel: Reel;
  onReelUpdated: () => void;
}

export function ReelEditor({ reel, onReelUpdated }: ReelEditorProps) {
  const [editText, setEditText] = useState(reel.finalText || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);

  async function handleSaveText() {
    if (!editText.trim()) return;
    setIsSaving(true);
    setError(null);

    try {
      await api.updateReelText(reel.id, editText.trim());
      onReelUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRerender() {
    setError(null);
    try {
      await api.rerenderReel(reel.id);
      onReelUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rerender');
    }
  }

  async function handleRetry() {
    setError(null);
    try {
      await api.retryReel(reel.id);
      onReelUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to retry');
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this reel and all its files?')) return;
    try {
      await api.deleteReel(reel.id);
      onReelUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  return (
    <div className="profile-editor">
      <div className="panel-header panel-header--editor">
        <div>
          <p className="panel-kicker">Reel details</p>
          <h2>Edit Reel</h2>
        </div>
        <button type="button" className="secondary-button danger-button" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="editor-meta">
        <p>Status: <strong>{reel.status}</strong></p>
        <p>Created: {new Date(reel.createdAt).toLocaleDateString()}</p>
        {reel.retryCount > 0 && <p>Retries: {reel.retryCount}</p>}
      </div>

      <div className="editor-preview">
        <p className="editor-preview__label">Source URL</p>
        <p className="editor-preview__value">
          <a href={reel.sourceUrl} target="_blank" rel="noopener noreferrer">{reel.sourceUrl}</a>
        </p>
      </div>

      {reel.processedVideo && (
        <div className="editor-preview">
          <p className="editor-preview__label">Processed Video</p>
          <VideoPlayer reelId={reel.id} filename="processed.mp4" />
        </div>
      )}

      {reel.originalVideo && !reel.processedVideo && (
        <div className="editor-preview">
          <p className="editor-preview__label">Original Video</p>
          <VideoPlayer reelId={reel.id} filename="original.mp4" />
        </div>
      )}

      {reel.originalText && (
        <div className="editor-preview">
          <p className="editor-preview__label">Detected Text (OCR)</p>
          <p className="editor-preview__value">{reel.originalText}</p>
        </div>
      )}

      <div className="editor-preview">
        <p className="editor-preview__label">Final Text</p>
        <textarea
          className="reel-text-input"
          rows={3}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="Enter text overlay for the video"
        />
        <div className="form-actions">
          <button
            type="button"
            className="primary-button"
            disabled={isSaving || !editText.trim()}
            onClick={handleSaveText}
          >
            {isSaving ? 'Saving...' : 'Save Text'}
          </button>
          {reel.status === 'ready' && (
            <button type="button" className="secondary-button" onClick={handleRerender}>
              Re-render
            </button>
          )}
        </div>
      </div>

      {reel.status === 'error' && (
        <div className="editor-preview" style={{ borderLeft: '3px solid #dc2626' }}>
          <p className="editor-preview__label" style={{ color: '#dc2626' }}>Error</p>
          <p className="editor-preview__value">{reel.errorMessage}</p>
          <p className="editor-preview__value" style={{ color: '#6b7280' }}>Stage: {reel.errorStage}</p>
          <button type="button" className="primary-button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {reel.status === 'ready' && (
        <div className="form-actions">
          <button type="button" className="primary-button" onClick={() => setShowPublish(true)}>
            Publish
          </button>
        </div>
      )}

      {error && <p className="panel-message panel-message--error">{error}</p>}

      {showPublish && (
        <ReelPublishDialog
          reelId={reel.id}
          onClose={() => setShowPublish(false)}
          onPublished={onReelUpdated}
        />
      )}
    </div>
  );
}
