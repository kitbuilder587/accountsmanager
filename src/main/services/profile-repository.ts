import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';

import type {
  CreateManagedProfileInput,
  ManagedProfile,
  UpdateManagedProfileInput,
} from '../../shared/profile.js';
import { managedProfileSchema } from '../../shared/profile.js';
import { db } from '../db/client.js';
import { managedProfilesTable, type ManagedProfileRow } from '../db/schema.js';
import { getAppPaths } from './app-paths.js';

function normalizeProfileRow(row: ManagedProfileRow): ManagedProfile {
  return managedProfileSchema.parse({
    id: row.id,
    platform: row.platform,
    accountLabel: row.accountLabel,
    note: row.note,
    profileDir: row.profileDir,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function getProfileDirectory(profileId: string): string {
  return path.join(getAppPaths().profilesDir, profileId);
}

export function listProfiles(): ManagedProfile[] {
  const rows = db
    .select()
    .from(managedProfilesTable)
    .orderBy(desc(managedProfilesTable.createdAt))
    .all();

  return rows.map(normalizeProfileRow);
}

export function createProfile(input: CreateManagedProfileInput): ManagedProfile {
  const now = new Date().toISOString();
  const id = randomUUID();
  const profileDir = getProfileDirectory(id);

  fs.mkdirSync(profileDir, { recursive: false });

  try {
    db.insert(managedProfilesTable).values({
      id,
      platform: input.platform,
      accountLabel: input.accountLabel,
      note: input.note ?? null,
      profileDir,
      createdAt: now,
      updatedAt: now,
    }).run();
  } catch (error) {
    fs.rmSync(profileDir, { recursive: true, force: true });
    throw error;
  }

  return normalizeProfileRow({
    id,
    platform: input.platform,
    accountLabel: input.accountLabel,
    note: input.note ?? null,
    profileDir,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateProfile(input: UpdateManagedProfileInput): ManagedProfile {
  const existingProfile = db
    .select()
    .from(managedProfilesTable)
    .where(eq(managedProfilesTable.id, input.id))
    .get();

  if (!existingProfile) {
    throw new Error(`Managed profile not found: ${input.id}`);
  }

  const updatedAt = new Date().toISOString();

  db.update(managedProfilesTable)
    .set({
      platform: input.platform,
      accountLabel: input.accountLabel,
      note: input.note,
      updatedAt,
    })
    .where(eq(managedProfilesTable.id, input.id))
    .run();

  return normalizeProfileRow({
    ...existingProfile,
    platform: input.platform,
    accountLabel: input.accountLabel,
    note: input.note,
    updatedAt,
  });
}
