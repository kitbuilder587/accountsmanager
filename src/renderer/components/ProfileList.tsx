import type { ManagedProfile } from '../../shared/profile.js';

interface ProfileListProps {
  profiles: ManagedProfile[];
  selectedProfileId: string | null;
  isLoading: boolean;
  loadError: string | null;
  onCreateProfile: () => void;
  onSelectProfile: (profileId: string) => void;
}

function formatPlatform(platform: ManagedProfile['platform']): string {
  return platform === 'youtube' ? 'YouTube' : 'Instagram';
}

function formatTimestamp(profile: ManagedProfile): string {
  const timestamp = profile.updatedAt || profile.createdAt;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function ProfileList({
  profiles,
  selectedProfileId,
  isLoading,
  loadError,
  onCreateProfile,
  onSelectProfile,
}: ProfileListProps) {
  return (
    <section className="panel panel--list">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Managed accounts</p>
          <h2>Accounts</h2>
        </div>
        <button type="button" className="primary-button" onClick={onCreateProfile}>
          Add Account
        </button>
      </div>

      {isLoading ? <p className="panel-message">Loading accounts...</p> : null}
      {loadError ? <p className="panel-message panel-message--error">{loadError}</p> : null}

      {!isLoading && !loadError && profiles.length === 0 ? (
        <div className="empty-state">
          <h2>Add your first account</h2>
          <p>
            Add a YouTube or Instagram account to manage its browser profile,
            proxy, and publishing.
          </p>
          <button type="button" className="primary-button" onClick={onCreateProfile}>
            Add Account
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && profiles.length > 0 ? (
        <div className="profile-list" role="list" aria-label="Managed accounts">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={
                profile.id === selectedProfileId ? 'profile-row profile-row--selected' : 'profile-row'
              }
              onClick={() => onSelectProfile(profile.id)}
            >
              <div className="profile-row__header">
                <span className="profile-row__label">{profile.accountLabel}</span>
                <div className="profile-row__badges">
                  <span className="platform-badge">{formatPlatform(profile.platform)}</span>
                  <span className={`status-dot status-dot--${profile.status}`} title={profile.status} />
                </div>
              </div>
              {profile.proxy && <p className="profile-row__proxy">{profile.proxy}</p>}
              <p className="profile-row__note">{profile.note || 'No note'}</p>
              <p className="profile-row__timestamp">Updated {formatTimestamp(profile)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
