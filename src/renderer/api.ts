import type { ManagedProfile, CreateManagedProfileInput, UpdateManagedProfileInput } from '../shared/profile.js';
import type { Reel, CreateReelInput, PublishReelInput, DetectedRegion } from '../shared/reel.js';
import type { PublishJob, CreatePublishJobInput, CreateBatchPublishJobsInput } from '../shared/publish-job.js';

const BASE_URL = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((error as any).error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Profile API
export async function listProfiles(): Promise<{ profiles: ManagedProfile[] }> {
  return fetchJson(`${BASE_URL}/profiles`);
}

export async function createProfile(input: CreateManagedProfileInput): Promise<{ profile: ManagedProfile }> {
  return fetchJson(`${BASE_URL}/profiles`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProfile(input: UpdateManagedProfileInput): Promise<{ profile: ManagedProfile }> {
  return fetchJson(`${BASE_URL}/profiles/${input.id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Reels API
export async function listReels(status?: string): Promise<{ reels: Reel[] }> {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchJson(`${BASE_URL}/reels${params}`);
}

export async function getReelById(id: string): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}`);
}

export async function createReelFromUrl(input: CreateReelInput): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateReelText(id: string, text: string): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/text`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  });
}

export async function updateReelRegions(id: string, regions: DetectedRegion[]): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/regions`, {
    method: 'PUT',
    body: JSON.stringify({ regions }),
  });
}

export async function updatePublishMeta(id: string, meta: { title?: string; description?: string; hashtags?: string }): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/publish-meta`, {
    method: 'PUT',
    body: JSON.stringify(meta),
  });
}

export async function approveReel(id: string): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/approve`, { method: 'POST' });
}

export async function rerenderReel(id: string): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/rerender`, { method: 'POST' });
}

export async function publishReel(id: string, input: PublishReelInput): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function retryReel(id: string): Promise<{ reel: Reel }> {
  return fetchJson(`${BASE_URL}/reels/${id}/retry`, { method: 'POST' });
}

export async function deleteReel(id: string): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/reels/${id}`, { method: 'DELETE' });
}

export function getReelMediaUrl(reelId: string, filename: string): string {
  const token = localStorage.getItem('auth_token');
  return `/media/reels/${reelId}/${filename}${token ? `?token=${token}` : ''}`;
}

// Profile extras
export async function deleteProfile(id: string): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/profiles/${id}`, { method: 'DELETE' });
}

// Publish Jobs API
export async function listPublishJobs(status?: string): Promise<{ jobs: PublishJob[] }> {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchJson(`${BASE_URL}/publish-jobs${params}`);
}

export async function createPublishJob(input: CreatePublishJobInput): Promise<{ job: PublishJob }> {
  return fetchJson(`${BASE_URL}/publish-jobs`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createBatchPublishJobs(input: CreateBatchPublishJobsInput): Promise<{ jobs: PublishJob[] }> {
  return fetchJson(`${BASE_URL}/publish-jobs/batch`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function retryPublishJob(id: string): Promise<{ job: PublishJob }> {
  return fetchJson(`${BASE_URL}/publish-jobs/${id}/retry`, { method: 'POST' });
}

export async function deletePublishJob(id: string): Promise<{ success: boolean }> {
  return fetchJson(`${BASE_URL}/publish-jobs/${id}`, { method: 'DELETE' });
}
