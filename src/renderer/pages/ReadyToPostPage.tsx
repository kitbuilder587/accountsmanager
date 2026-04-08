import { useEffect, useState } from 'react';

import type { ManagedProfile } from '../../shared/profile.js';
import type { Reel } from '../../shared/reel.js';
import type { PublishJob } from '../../shared/publish-job.js';
import * as api from '../api.js';

export function ReadyToPostPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [pendingJobs, setPendingJobs] = useState<PublishJob[]>([]);
  const [selectedReelIds, setSelectedReelIds] = useState<Set<string>>(new Set());
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [reelsRes, profilesRes, jobsRes] = await Promise.all([
          api.listReels('ready'),
          api.listProfiles(),
          api.listPublishJobs(),
        ]);
        setReels(reelsRes.reels);
        setProfiles(profilesRes.profiles.filter(p => p.status === 'active'));
        setPendingJobs(jobsRes.jobs.filter(j => j.status === 'pending' || j.status === 'scheduled'));
      } catch {
        setError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  function toggleReel(id: string) {
    setSelectedReelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedReelIds.size === reels.length) {
      setSelectedReelIds(new Set());
    } else {
      setSelectedReelIds(new Set(reels.map(r => r.id)));
    }
  }

  async function handleCreateJobs() {
    if (selectedReelIds.size === 0 || !selectedProfileId) return;

    setIsCreating(true);
    setError(null);
    try {
      const profile = profiles.find(p => p.id === selectedProfileId);
      if (!profile) {
        setError('Selected account not found');
        return;
      }
      const res = await api.createBatchPublishJobs({
        reelIds: Array.from(selectedReelIds),
        profileId: selectedProfileId,
        platform: profile.platform,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      setPendingJobs(prev => [...res.jobs, ...prev]);
      setSelectedReelIds(new Set());
      // Remove published reels from the list (they now have jobs)
      const jobReelIds = new Set(res.jobs.map(j => j.reelId));
      setReels(prev => prev.filter(r => !jobReelIds.has(r.id)));
    } catch (err: any) {
      setError(err.message || 'Failed to create jobs');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteJob(jobId: string) {
    try {
      await api.deletePublishJob(jobId);
      setPendingJobs(prev => prev.filter(j => j.id !== jobId));
    } catch {
      setError('Failed to cancel job');
    }
  }

  if (isLoading) return <div className="empty-state"><p>Loading...</p></div>;

  return (
    <div className="ready-page">
      <div className="ready-page__grid">
        {/* Left: Ready reels */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Ready reels</p>
              <h2>Select Reels ({reels.length})</h2>
            </div>
            {reels.length > 0 && (
              <button type="button" className="secondary-button" onClick={selectAll}>
                {selectedReelIds.size === reels.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {reels.length === 0 ? (
            <div className="empty-state">
              <p>No reels ready for publishing. Process reels in the Pipeline tab first.</p>
            </div>
          ) : (
            <div className="ready-reel-list">
              {reels.map(reel => (
                <label key={reel.id} className={`ready-reel-item ${selectedReelIds.has(reel.id) ? 'ready-reel-item--selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedReelIds.has(reel.id)}
                    onChange={() => toggleReel(reel.id)}
                  />
                  <div className="ready-reel-item__info">
                    {reel.thumbnail && (
                      <img
                        src={api.getReelMediaUrl(reel.id, reel.thumbnail)}
                        alt=""
                        className="ready-reel-item__thumb"
                      />
                    )}
                    <div>
                      <p className="ready-reel-item__title">{reel.publishTitle || reel.finalText?.slice(0, 60) || reel.sourceUrl}</p>
                      {reel.publishDescription && <p className="ready-reel-item__desc">{reel.publishDescription.slice(0, 80)}</p>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Right: Publish config + queue */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Publish</p>
              <h2>Create Jobs</h2>
            </div>
          </div>

          <div className="publish-config">
            <label className="form-field">
              <span>Account</span>
              <select
                value={selectedProfileId}
                onChange={e => setSelectedProfileId(e.target.value)}
              >
                <option value="">Select account...</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.accountLabel} ({p.platform})
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Schedule (optional)</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
              />
            </label>

            {error && <p className="panel-message panel-message--error">{error}</p>}

            <button
              type="button"
              className="primary-button"
              disabled={selectedReelIds.size === 0 || !selectedProfileId || isCreating}
              onClick={() => void handleCreateJobs()}
            >
              {isCreating ? 'Creating...' : `Create ${selectedReelIds.size} Job${selectedReelIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Pending jobs queue */}
          {pendingJobs.length > 0 && (
            <div className="pending-jobs">
              <h3>Pending Jobs ({pendingJobs.length})</h3>
              <div className="pending-jobs-list">
                {pendingJobs.map(job => {
                  const profile = profiles.find(p => p.id === job.profileId);
                  return (
                    <div key={job.id} className="pending-job-item">
                      <div className="pending-job-item__info">
                        <span className={`status-badge status-badge--job-${job.status}`}>{job.status}</span>
                        <span>{profile?.accountLabel || 'Unknown'}</span>
                        {job.scheduledAt && <span className="pending-job-item__time">{new Date(job.scheduledAt).toLocaleString()}</span>}
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleDeleteJob(job.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
