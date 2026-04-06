import { useState } from 'react';
import type { Reel, DetectedRegion } from '../../shared/reel.js';
import * as api from '../api.js';
import { VideoPlayer } from './VideoPlayer.js';
import { ReelPublishDialog } from './ReelPublishDialog.js';
import { RegionEditor } from './RegionEditor.js';

interface ReelEditorProps {
  reel: Reel;
  onReelUpdated: () => void;
}

export function ReelEditor({ reel, onReelUpdated }: ReelEditorProps) {
  const [editText, setEditText] = useState(reel.finalText || '');
  const [pubTitle, setPubTitle] = useState(reel.publishTitle || '');
  const [pubDescription, setPubDescription] = useState(reel.publishDescription || '');
  const [pubHashtags, setPubHashtags] = useState(reel.publishHashtags || '');
  const [regions, setRegions] = useState<DetectedRegion[]>(reel.detectedRegions || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
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

  async function handleSaveRegions() {
    setIsSaving(true);
    setError(null);
    try {
      await api.updateReelRegions(reel.id, regions);
      onReelUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save regions');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApprove() {
    setIsApproving(true);
    setError(null);
    try {
      // Save regions first, then approve
      await api.updateReelRegions(reel.id, regions);
      await api.approveReel(reel.id);
      onReelUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setIsApproving(false);
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

      {/* Region editor — shown when we have detected regions (review state or after OCR) */}
      {regions.length > 0 && (
        <div className="editor-preview">
          <p className="editor-preview__label">Detected Text Regions</p>
          <p className="editor-preview__value" style={{ color: '#6b7280', fontSize: 14 }}>
            Green = replace with new text, Red = mask/hide, Gray = keep unchanged
          </p>
          <RegionEditor
            reelId={reel.id}
            regions={regions}
            onRegionsChange={setRegions}
          />
          <div className="form-actions">
            <button type="button" className="secondary-button" disabled={isSaving} onClick={handleSaveRegions}>
              {isSaving ? 'Saving...' : 'Save Regions'}
            </button>
          </div>
        </div>
      )}

      {/* Approve button — shown in review state */}
      {reel.status === 'review' && (
        <div className="editor-preview" style={{ borderLeft: '3px solid #22c55e' }}>
          <p className="editor-preview__label" style={{ color: '#22c55e' }}>Review & Approve</p>
          <p className="editor-preview__value">
            Check the detected regions above. Adjust actions if needed, then approve to continue processing.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="primary-button"
              disabled={isApproving}
              onClick={handleApprove}
              style={{ backgroundColor: '#22c55e' }}
            >
              {isApproving ? 'Approving...' : 'Approve & Continue'}
            </button>
          </div>
        </div>
      )}

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

      {/* Publish metadata (title, description, hashtags for YouTube/Instagram) */}
      {(reel.publishTitle || reel.status === 'ready' || reel.status === 'review') && (
        <div className="editor-preview">
          <p className="editor-preview__label">Publish Metadata</p>
          <label className="form-field">
            <span>Title (YouTube/Instagram)</span>
            <input
              type="text"
              className="reel-url-input"
              value={pubTitle}
              onChange={(e) => setPubTitle(e.target.value)}
              placeholder="Catchy title for the video"
            />
          </label>
          <label className="form-field">
            <span>Description</span>
            <textarea
              className="reel-text-input"
              rows={3}
              value={pubDescription}
              onChange={(e) => setPubDescription(e.target.value)}
              placeholder="Video description with CTA"
            />
          </label>
          <label className="form-field">
            <span>Hashtags</span>
            <input
              type="text"
              className="reel-url-input"
              value={pubHashtags}
              onChange={(e) => setPubHashtags(e.target.value)}
              placeholder="#shorts #рилс #видео"
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                setError(null);
                try {
                  await api.updatePublishMeta(reel.id, {
                    title: pubTitle,
                    description: pubDescription,
                    hashtags: pubHashtags,
                  });
                  onReelUpdated();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to save');
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? 'Saving...' : 'Save Metadata'}
            </button>
          </div>
        </div>
      )}

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
