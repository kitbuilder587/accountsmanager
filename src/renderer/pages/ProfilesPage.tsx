import { useEffect, useMemo, useState } from 'react';

import type { ManagedProfile, UpdateManagedProfileInput } from '../../shared/profile.js';
import type { ProfileFormValues } from '../components/ProfileForm.js';
import { ProfileEditor } from '../components/ProfileEditor.js';
import { ProfileForm } from '../components/ProfileForm.js';
import { ProfileList } from '../components/ProfileList.js';
import * as api from '../api.js';

const PERSISTENCE_ERROR =
  'Profile could not be saved. Check the platform and account label, then try again.';

const CREATE_DEFAULTS: ProfileFormValues = {
  platform: 'youtube',
  accountLabel: '',
  note: null,
};

function sortProfiles(profiles: ManagedProfile[]): ManagedProfile[] {
  return [...profiles].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function loadProfiles() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await api.listProfiles();
        const nextProfiles = sortProfiles(response.profiles);

        setProfiles(nextProfiles);
        setSelectedProfileId((current) => {
          if (!nextProfiles.length) return null;
          if (current && nextProfiles.some((profile) => profile.id === current)) return current;
          return nextProfiles[0]?.id ?? null;
        });
      } catch {
        setLoadError('Profiles could not be loaded right now. Restart the app and try again.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfiles();
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  async function handleCreateProfile(input: ProfileFormValues): Promise<void> {
    setCreateError(null);
    setIsCreating(true);

    try {
      const response = await api.createProfile(input);
      const nextProfiles = sortProfiles([response.profile, ...profiles]);
      setProfiles(nextProfiles);
      setSelectedProfileId(response.profile.id);
    } catch {
      setCreateError(PERSISTENCE_ERROR);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateProfile(input: UpdateManagedProfileInput): Promise<void> {
    setUpdateError(null);
    setIsUpdating(true);

    try {
      const response = await api.updateProfile(input);
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === response.profile.id ? response.profile : profile,
        ),
      );
      setSelectedProfileId(response.profile.id);
    } catch {
      setUpdateError(PERSISTENCE_ERROR);
    } finally {
      setIsUpdating(false);
    }
  }

  function handleSelectProfile(profileId: string): void {
    setSelectedProfileId(profileId);
    setUpdateError(null);
  }

  function handleStartCreate(): void {
    setSelectedProfileId(null);
    setCreateError(null);
    setUpdateError(null);
  }

  function handleCancelEditing(): void {
    setUpdateError(null);
    setSelectedProfileId(profiles[0]?.id ?? null);
  }

  return (
    <div className="workspace-grid">
      <ProfileList
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        isLoading={isLoading}
        loadError={loadError}
        onCreateProfile={handleStartCreate}
        onSelectProfile={handleSelectProfile}
      />

      <section className="panel panel--editor" aria-live="polite">
        {!selectedProfile ? (
          <ProfileForm
            title={profiles.length ? 'Create Profile' : 'Create your first managed profile'}
            description={
              profiles.length
                ? 'Add another managed profile for a YouTube or Instagram account.'
                : 'Add a YouTube or Instagram profile to reserve its own browser directory and prepare it for isolated launches later.'
            }
            submitLabel="Create Profile"
            initialValues={CREATE_DEFAULTS}
            persistenceError={createError}
            isSaving={isCreating}
            onSubmit={handleCreateProfile}
          />
        ) : (
          <ProfileEditor
            profile={selectedProfile}
            persistenceError={updateError}
            isSaving={isUpdating}
            onCancel={handleCancelEditing}
            onSubmit={(values) =>
              handleUpdateProfile({
                id: selectedProfile.id,
                platform: values.platform,
                accountLabel: values.accountLabel,
                note: values.note,
              })
            }
          />
        )}
      </section>
    </div>
  );
}
