import type {
  CreateManagedProfileInput,
  ManagedProfile,
  UpdateManagedProfileInput,
} from './profile.js';

export const PROFILE_CHANNELS = {
  listProfiles: 'profile:list',
  createProfile: 'profile:create',
  updateProfile: 'profile:update',
} as const;

export type ProfileChannel =
  (typeof PROFILE_CHANNELS)[keyof typeof PROFILE_CHANNELS];

export interface ListProfilesResponse {
  profiles: ManagedProfile[];
}

export interface CreateProfileResponse {
  profile: ManagedProfile;
}

export interface UpdateProfileResponse {
  profile: ManagedProfile;
}

export interface AccountsManagerApi {
  listProfiles: () => Promise<ListProfilesResponse>;
  createProfile: (input: CreateManagedProfileInput) => Promise<CreateProfileResponse>;
  updateProfile: (input: UpdateManagedProfileInput) => Promise<UpdateProfileResponse>;
}

declare global {
  interface Window {
    accountsManager: AccountsManagerApi;
  }
}

export {};
