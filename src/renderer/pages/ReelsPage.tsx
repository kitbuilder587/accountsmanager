import { useState } from 'react';
import type { Reel } from '../../shared/reel.js';
import { ReelsList } from '../components/ReelsList.js';
import { ReelEditor } from '../components/ReelEditor.js';
import * as api from '../api.js';

export function ReelsPage() {
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newUrl, setNewUrl] = useState('');
  const [customText, setCustomText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function handleReelUpdated() {
    setRefreshKey((k) => k + 1);
    if (selectedReel) {
      api.getReelById(selectedReel.id).then(
        (res) => setSelectedReel(res.reel),
        () => setSelectedReel(null),
      );
    }
  }

  async function handleAddReel() {
    if (!newUrl.trim()) return;
    setIsAdding(true);
    setAddError(null);

    try {
      const response = await api.createReelFromUrl({
        sourceUrl: newUrl.trim(),
        customText: customText.trim() || undefined,
      });
      setNewUrl('');
      setCustomText('');
      setSelectedReel(response.reel);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add reel');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="workspace-grid">
      <div className="reels-sidebar">
        <div className="panel add-reel-panel">
          <p className="panel-kicker">Add reel</p>
          <input
            type="url"
            className="reel-url-input"
            placeholder="Instagram Reel or TikTok URL"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <input
            type="text"
            className="reel-url-input"
            placeholder="Custom text (optional)"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
          <button
            type="button"
            className="primary-button"
            disabled={isAdding || !newUrl.trim()}
            onClick={handleAddReel}
          >
            {isAdding ? 'Adding...' : 'Add Reel'}
          </button>
          {addError && <p className="panel-message panel-message--error">{addError}</p>}
        </div>

        <ReelsList
          onSelectReel={setSelectedReel}
          selectedReelId={selectedReel?.id ?? null}
          refreshKey={refreshKey}
        />
      </div>

      <section className="panel panel--editor" aria-live="polite">
        {selectedReel ? (
          <ReelEditor key={selectedReel.id} reel={selectedReel} onReelUpdated={handleReelUpdated} />
        ) : (
          <div className="empty-state">
            <h2>Select a reel</h2>
            <p>
              Choose a reel from the list or add a new one. You can also send links
              to the Telegram bot for automatic processing.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
