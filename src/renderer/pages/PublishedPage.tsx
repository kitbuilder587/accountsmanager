import { useEffect, useState } from 'react';

import type { ManagedProfile } from '../../shared/profile.js';
import type { PublishJob } from '../../shared/publish-job.js';
import * as api from '../api.js';

type FilterStatus = 'all' | 'published' | 'error' | 'publishing';

export function PublishedPage() {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [jobsRes, profilesRes] = await Promise.all([
          api.listPublishJobs(),
          api.listProfiles(),
        ]);
        // Show only completed/errored/in-progress jobs
        setJobs(jobsRes.jobs.filter(j => j.status === 'published' || j.status === 'error' || j.status === 'publishing'));
        setProfiles(profilesRes.profiles);
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const filteredJobs = filter === 'all'
    ? jobs
    : jobs.filter(j => j.status === filter);

  async function handleRetry(jobId: string) {
    try {
      const res = await api.retryPublishJob(jobId);
      setJobs(prev => prev.map(j => j.id === jobId ? res.job : j));
    } catch {
      // ignore
    }
  }

  if (isLoading) return <div className="empty-state"><p>Loading...</p></div>;

  return (
    <div className="published-page">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">History</p>
            <h2>Published ({filteredJobs.length})</h2>
          </div>
          <div className="filter-tabs">
            {(['all', 'published', 'error', 'publishing'] as FilterStatus[]).map(s => (
              <button
                key={s}
                type="button"
                className={`filter-tab ${filter === s ? 'filter-tab--active' : ''}`}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <p>{filter === 'all' ? 'No publishing history yet.' : `No ${filter} jobs.`}</p>
          </div>
        ) : (
          <div className="published-list">
            {filteredJobs.map(job => {
              const profile = profiles.find(p => p.id === job.profileId);
              return (
                <div key={job.id} className="published-item">
                  <div className="published-item__main">
                    <span className={`status-badge status-badge--job-${job.status}`}>{job.status}</span>
                    <span className="published-item__account">{profile?.accountLabel || 'Unknown'}</span>
                    <span className="platform-badge">{job.platform}</span>
                  </div>
                  <div className="published-item__meta">
                    {job.publishedAt && <span>Published {new Date(job.publishedAt).toLocaleString()}</span>}
                    {job.errorMessage && <span className="published-item__error">{job.errorMessage}</span>}
                    <span>Created {new Date(job.createdAt).toLocaleString()}</span>
                  </div>
                  {job.status === 'error' && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleRetry(job.id)}
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
