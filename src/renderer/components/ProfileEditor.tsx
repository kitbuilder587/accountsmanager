import { useState } from 'react';

import type { ManagedProfile } from '../../shared/profile.js';
import { ProfileForm } from './ProfileForm.js';

interface ProfileEditorProps {
  profile: ManagedProfile;
  persistenceError: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onDelete: (id: string) => Promise<void>;
  onSubmit: (values: {
    platform: ManagedProfile['platform'];
    accountLabel: string;
    note: string | null;
    proxy: string | null;
  }) => Promise<void>;
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
};

const LOGIN_LABELS: Record<string, string> = {
  logged_in: 'Logged In',
  logged_out: 'Logged Out',
  needs_reauth: 'Needs Re-auth',
};

export function ProfileEditor({
  profile,
  persistenceError,
  isSaving,
  onCancel,
  onDelete,
  onSubmit,
}: ProfileEditorProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete profile "${profile.accountLabel}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await onDelete(profile.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="profile-editor">
      <div className="editor-meta">
        <div className="editor-meta__badges">
          <span className={`status-badge status-badge--${profile.status}`}>
            {STATUS_LABELS[profile.status] || profile.status}
          </span>
          <span className={`status-badge status-badge--login-${profile.loginStatus}`}>
            {LOGIN_LABELS[profile.loginStatus] || profile.loginStatus}
          </span>
        </div>
        <p>Created {formatDate(profile.createdAt)} &middot; Updated {formatDate(profile.updatedAt)}</p>
        {profile.proxy && <p className="editor-meta__proxy">Proxy: {profile.proxy}</p>}
      </div>

      <ProfileForm
        title="Edit Profile"
        description="Update the platform, account label, proxy, or note for this managed profile."
        submitLabel="Save Changes"
        initialValues={{
          platform: profile.platform,
          accountLabel: profile.accountLabel,
          note: profile.note,
          proxy: profile.proxy,
        }}
        persistenceError={persistenceError}
        isSaving={isSaving}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />

      <div className="danger-zone">
        <button
          type="button"
          className="danger-button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete Profile'}
        </button>
      </div>
    </div>
  );
}
