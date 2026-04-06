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
          <p className="panel-kicker">Managed profiles</p>
          <h2>Profile Registry</h2>
        </div>
        <button type="button" className="primary-button" onClick={onCreateProfile}>
          Create Profile
        </button>
      </div>

      {isLoading ? <p className="panel-message">Loading profiles…</p> : null}
      {loadError ? <p className="panel-message panel-message--error">{loadError}</p> : null}

      {!isLoading && !loadError && profiles.length === 0 ? (
        <div className="empty-state">
          <h2>Create your first managed profile</h2>
          <p>
            Add a YouTube or Instagram profile to reserve its own browser directory and
            prepare it for isolated launches later.
          </p>
          <button type="button" className="primary-button" onClick={onCreateProfile}>
            Create Profile
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && profiles.length > 0 ? (
        <div className="profile-list" role="list" aria-label="Managed profiles">
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
                <span className="platform-badge">{formatPlatform(profile.platform)}</span>
              </div>
              <p className="profile-row__note">{profile.note || 'No note added yet.'}</p>
              <p className="profile-row__timestamp">Updated {formatTimestamp(profile)}</p>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
