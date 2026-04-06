import { ipcMain } from 'electron';

import {
  type CreateProfileResponse,
  type ListProfilesResponse,
  PROFILE_CHANNELS,
  type UpdateProfileResponse,
} from '../../shared/ipc.js';
import {
  createManagedProfileSchema,
  updateManagedProfileSchema,
} from '../../shared/profile.js';
import {
  createProfile,
  listProfiles,
  updateProfile,
} from '../services/profile-repository.js';

export function registerProfileHandlers(): void {
  ipcMain.removeHandler(PROFILE_CHANNELS.listProfiles);
  ipcMain.removeHandler(PROFILE_CHANNELS.createProfile);
  ipcMain.removeHandler(PROFILE_CHANNELS.updateProfile);

  ipcMain.handle(PROFILE_CHANNELS.listProfiles, (): ListProfilesResponse => ({
    profiles: listProfiles(),
  }));

  ipcMain.handle(
    PROFILE_CHANNELS.createProfile,
    (_event, payload): CreateProfileResponse => {
      const input = createManagedProfileSchema.parse(payload);

      return {
        profile: createProfile(input),
      };
    },
  );

  ipcMain.handle(
    PROFILE_CHANNELS.updateProfile,
    (_event, payload): UpdateProfileResponse => {
      const input = updateManagedProfileSchema.parse(payload);

      return {
        profile: updateProfile(input),
      };
    },
  );
}
