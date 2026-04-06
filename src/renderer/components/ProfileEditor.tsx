import type { ManagedProfile } from '../../shared/profile.js';
import { ProfileForm } from './ProfileForm.js';

interface ProfileEditorProps {
  profile: ManagedProfile;
  persistenceError: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    platform: ManagedProfile['platform'];
    accountLabel: string;
    note: string | null;
  }) => Promise<void>;
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function ProfileEditor({
  profile,
  persistenceError,
  isSaving,
  onCancel,
  onSubmit,
}: ProfileEditorProps) {
  return (
    <div className="profile-editor">
      <div className="editor-meta">
        <p>Created {formatDate(profile.createdAt)}</p>
        <p>Updated {formatDate(profile.updatedAt)}</p>
      </div>

      <ProfileForm
        title="Edit Profile"
        description="Update the platform, account label, or note for this managed profile."
        submitLabel="Save Changes"
        initialValues={{
          platform: profile.platform,
          accountLabel: profile.accountLabel,
          note: profile.note,
        }}
        persistenceError={persistenceError}
        isSaving={isSaving}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  );
}
