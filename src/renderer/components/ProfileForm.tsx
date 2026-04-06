import { useEffect, useState } from 'react';

import type {
  CreateManagedProfileInput,
  ManagedProfilePlatform,
} from '../../shared/profile.js';

interface ProfileFormValues {
  platform: ManagedProfilePlatform;
  accountLabel: string;
  note: string | null;
}

interface ProfileFormProps {
  title: string;
  description: string;
  submitLabel: string;
  initialValues: ProfileFormValues;
  persistenceError: string | null;
  isSaving: boolean;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  onCancel?: () => void;
}

interface FormErrors {
  platform?: string;
  accountLabel?: string;
}

const PLATFORM_OPTIONS: Array<{ value: ManagedProfilePlatform; label: string }> = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
];

function normalizeNote(note: string): string | null {
  const value = note.trim();
  return value ? value : null;
}

function validate(values: ProfileFormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.platform) {
    errors.platform = 'Select a platform.';
  }

  if (!values.accountLabel.trim()) {
    errors.accountLabel = 'Enter an account label.';
  }

  return errors;
}

export function ProfileForm({
  title,
  description,
  submitLabel,
  initialValues,
  persistenceError,
  isSaving,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const [platform, setPlatform] = useState<ManagedProfilePlatform>(initialValues.platform);
  const [accountLabel, setAccountLabel] = useState(initialValues.accountLabel);
  const [note, setNote] = useState(initialValues.note ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    setPlatform(initialValues.platform);
    setAccountLabel(initialValues.accountLabel);
    setNote(initialValues.note ?? '');
    setErrors({});
  }, [initialValues]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextValues: ProfileFormValues = {
      platform,
      accountLabel,
      note: normalizeNote(note),
    };
    const nextErrors = validate(nextValues);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit(nextValues);
  }

  return (
    <div className="profile-form-shell">
      <div className="panel-header panel-header--editor">
        <div>
          <p className="panel-kicker">Profile details</p>
          <h2>{title}</h2>
        </div>
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel Editing
          </button>
        ) : null}
      </div>

      <p className="panel-copy">{description}</p>

      <form className="profile-form" onSubmit={(event) => void handleSubmit(event)}>
        <fieldset className="form-group">
          <legend>Platform</legend>
          <div className="platform-options">
            {PLATFORM_OPTIONS.map((option) => (
              <label key={option.value} className="platform-option">
                <input
                  type="radio"
                  name="platform"
                  value={option.value}
                  checked={platform === option.value}
                  onChange={() => setPlatform(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.platform ? <p className="field-error">{errors.platform}</p> : null}
        </fieldset>

        <label className="form-field">
          <span>Account Label</span>
          <input
            type="text"
            name="accountLabel"
            value={accountLabel}
            onChange={(event) => setAccountLabel(event.target.value)}
            placeholder="Channel or account name"
          />
          {errors.accountLabel ? <p className="field-error">{errors.accountLabel}</p> : null}
        </label>

        <label className="form-field">
          <span>Note</span>
          <textarea
            name="note"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context for this profile"
          />
        </label>

        {persistenceError ? <p className="panel-message panel-message--error">{persistenceError}</p> : null}

        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export type { ProfileFormValues };
