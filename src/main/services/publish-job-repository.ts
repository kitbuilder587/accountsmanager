import { randomUUID } from 'node:crypto';

import { desc, eq, and, lte, inArray } from 'drizzle-orm';

import type {
  PublishJob,
  PublishJobStatus,
  CreatePublishJobInput,
} from '../../shared/publish-job.js';
import { publishJobSchema } from '../../shared/publish-job.js';
import { db } from '../db/client.js';
import { publishJobsTable, type PublishJobRow } from '../db/schema.js';

function normalizeJobRow(row: PublishJobRow): PublishJob {
  return publishJobSchema.parse({
    id: row.id,
    reelId: row.reelId,
    profileId: row.profileId,
    platform: row.platform,
    status: row.status,
    scheduledAt: row.scheduledAt,
    publishedAt: row.publishedAt,
    errorMessage: row.errorMessage,
    retryCount: row.retryCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function listPublishJobs(status?: string): PublishJob[] {
  if (status) {
    const rows = db
      .select()
      .from(publishJobsTable)
      .where(eq(publishJobsTable.status, status))
      .orderBy(desc(publishJobsTable.createdAt))
      .all();
    return rows.map(normalizeJobRow);
  }

  return db
    .select()
    .from(publishJobsTable)
    .orderBy(desc(publishJobsTable.createdAt))
    .all()
    .map(normalizeJobRow);
}

export function getPublishJobById(id: string): PublishJob | null {
  const row = db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.id, id))
    .get();

  return row ? normalizeJobRow(row) : null;
}

export function getPublishJobsByReelId(reelId: string): PublishJob[] {
  return db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.reelId, reelId))
    .orderBy(desc(publishJobsTable.createdAt))
    .all()
    .map(normalizeJobRow);
}

export function createPublishJob(input: CreatePublishJobInput): PublishJob {
  const now = new Date().toISOString();
  const id = randomUUID();
  const status = input.scheduledAt ? 'scheduled' : 'pending';

  db.insert(publishJobsTable).values({
    id,
    reelId: input.reelId,
    profileId: input.profileId,
    platform: input.platform,
    status,
    scheduledAt: input.scheduledAt ?? null,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  }).run();

  return normalizeJobRow({
    id,
    reelId: input.reelId,
    profileId: input.profileId,
    platform: input.platform,
    status,
    scheduledAt: input.scheduledAt ?? null,
    publishedAt: null,
    errorMessage: null,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export function createBatchPublishJobs(
  reelIds: string[],
  profileId: string,
  platform: 'youtube' | 'instagram',
  scheduledAt?: string | null,
): PublishJob[] {
  return reelIds.map(reelId =>
    createPublishJob({ reelId, profileId, platform, scheduledAt })
  );
}

export function updatePublishJobStatus(
  id: string,
  status: PublishJobStatus,
  extra?: Partial<Pick<PublishJobRow, 'publishedAt' | 'errorMessage' | 'retryCount'>>,
): PublishJob | null {
  const now = new Date().toISOString();

  db.update(publishJobsTable)
    .set({ status, updatedAt: now, ...extra })
    .where(eq(publishJobsTable.id, id))
    .run();

  return getPublishJobById(id);
}

export function getDueJobs(): PublishJob[] {
  const now = new Date().toISOString();

  // Get pending jobs (no schedule) and scheduled jobs whose time has come
  const pendingRows = db
    .select()
    .from(publishJobsTable)
    .where(eq(publishJobsTable.status, 'pending'))
    .all();

  const scheduledRows = db
    .select()
    .from(publishJobsTable)
    .where(
      and(
        eq(publishJobsTable.status, 'scheduled'),
        lte(publishJobsTable.scheduledAt, now),
      )
    )
    .all();

  return [...pendingRows, ...scheduledRows].map(normalizeJobRow);
}

export function deletePublishJob(id: string): boolean {
  const job = getPublishJobById(id);
  if (!job) return false;

  db.delete(publishJobsTable).where(eq(publishJobsTable.id, id)).run();
  return true;
}

export function deletePublishJobsByReelId(reelId: string): number {
  const jobs = getPublishJobsByReelId(reelId);
  if (jobs.length === 0) return 0;

  db.delete(publishJobsTable)
    .where(eq(publishJobsTable.reelId, reelId))
    .run();

  return jobs.length;
}
