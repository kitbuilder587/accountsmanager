import { useEffect, useState } from 'react';
import type { ManagedProfile } from '../../shared/profile.js';
import * as api from '../api.js';

interface ReelPublishDialogProps {
  reelId: string;
  onClose: () => void;
  onPublished: () => void;
}

export function ReelPublishDialog({ reelId, onClose, onPublished }: ReelPublishDialogProps) {
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [platform, setPlatform] = useState<'youtube' | 'instagram'>('youtube');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await api.listProfiles();
        setProfiles(response.profiles);
        if (response.profiles.length > 0) {
          setSelectedProfileId(response.profiles[0].id);
          setPlatform(response.profiles[0].platform);
        }
      } catch {
        setError('Failed to load profiles');
      }
    }
    void load();
  }, []);

  async function handlePublish() {
    if (!selectedProfileId) return;
    setIsPublishing(true);
    setError(null);

    try {
      await api.publishReel(reelId, { profileId: selectedProfileId, platform });
      onPublished();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  }

  function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) setPlatform(profile.platform);
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Publish Reel</h3>
        <p>Select a profile and platform for publishing.</p>

        {profiles.length === 0 ? (
          <p className="panel-message">No profiles available. Create a profile first.</p>
        ) : (
          <>
            <label className="form-field">
              <span>Profile</span>
              <select
                value={selectedProfileId}
                onChange={(e) => handleProfileChange(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.accountLabel} ({p.platform})
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Platform</span>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as any)}>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
              </select>
            </label>
          </>
        )}

        {error && <p className="panel-message panel-message--error">{error}</p>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isPublishing || !selectedProfileId}
            onClick={handlePublish}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
