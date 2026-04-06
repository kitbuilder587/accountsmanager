import { contextBridge, ipcRenderer } from 'electron';

import type {
  AccountsManagerApi,
  CreateProfileResponse,
  ListProfilesResponse,
  UpdateProfileResponse,
} from '../src/shared/ipc.js';
import { PROFILE_CHANNELS } from '../src/shared/ipc.js';
import type {
  CreateManagedProfileInput,
  UpdateManagedProfileInput,
} from '../src/shared/profile.js';

const accountsManagerApi: AccountsManagerApi = {
  listProfiles: () =>
    ipcRenderer.invoke(PROFILE_CHANNELS.listProfiles) as Promise<ListProfilesResponse>,
  createProfile: (input: CreateManagedProfileInput) =>
    ipcRenderer.invoke(PROFILE_CHANNELS.createProfile, input) as Promise<CreateProfileResponse>,
  updateProfile: (input: UpdateManagedProfileInput) =>
    ipcRenderer.invoke(PROFILE_CHANNELS.updateProfile, input) as Promise<UpdateProfileResponse>,
};

contextBridge.exposeInMainWorld('accountsManager', accountsManagerApi);
