import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';

import type { CreateReelInput, Reel, ReelStatus } from '../../shared/reel.js';
import { reelSchema } from '../../shared/reel.js';
import { db } from '../db/client.js';
import { reelsTable, type ReelRow } from '../db/reels-schema.js';
import { getAppPaths } from './app-paths.js';

function parseDetectedRegions(raw: string | null): any[] | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function normalizeReelRow(row: ReelRow): Reel {
  return reelSchema.parse({
    id: row.id,
    sourceUrl: row.sourceUrl,
    telegramChatId: row.telegramChatId,
    telegramMessageId: row.telegramMessageId,
    status: row.status,
    originalText: row.originalText,
    customText: row.customText,
    generatedText: row.generatedText,
    finalText: row.finalText,
    textRegionX: row.textRegionX,
    textRegionY: row.textRegionY,
    textRegionW: row.textRegionW,
    textRegionH: row.textRegionH,
    detectedRegions: parseDetectedRegions(row.detectedRegions ?? null),
    publishTitle: row.publishTitle,
    publishDescription: row.publishDescription,
    publishHashtags: row.publishHashtags,
    originalVideo: row.originalVideo,
    processedVideo: row.processedVideo,
    thumbnail: row.thumbnail,
    publishedProfileId: row.publishedProfileId,
    publishedPlatform: row.publishedPlatform,
    publishedAt: row.publishedAt,
    publishError: row.publishError,
    errorMessage: row.errorMessage,
    errorStage: row.errorStage,
    retryCount: row.retryCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function getReelDirectory(reelId: string): string {
  return path.join(getAppPaths().reelsDir, reelId);
}

export function listReels(status?: string): Reel[] {
  let query = db.select().from(reelsTable).orderBy(desc(reelsTable.createdAt));

  if (status) {
    const rows = db
      .select()
      .from(reelsTable)
      .where(eq(reelsTable.status, status))
      .orderBy(desc(reelsTable.createdAt))
      .all();
    return rows.map(normalizeReelRow);
  }

  return query.all().map(normalizeReelRow);
}

export function getReelById(id: string): Reel | null {
  const row = db
    .select()
    .from(reelsTable)
    .where(eq(reelsTable.id, id))
    .get();

  return row ? normalizeReelRow(row) : null;
}

export function createReel(input: CreateReelInput): Reel {
  const now = new Date().toISOString();
  const id = randomUUID();
  const reelDir = getReelDirectory(id);

  fs.mkdirSync(reelDir, { recursive: true });

  db.insert(reelsTable).values({
    id,
    sourceUrl: input.sourceUrl,
    customText: input.customText ?? null,
    telegramChatId: input.telegramChatId ?? null,
    telegramMessageId: input.telegramMessageId ?? null,
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  }).run();

  return normalizeReelRow({
    id,
    sourceUrl: input.sourceUrl,
    telegramChatId: input.telegramChatId ?? null,
    telegramMessageId: input.telegramMessageId ?? null,
    status: 'pending',
    originalText: null,
    customText: input.customText ?? null,
    generatedText: null,
    finalText: null,
    textRegionX: null,
    textRegionY: null,
    textRegionW: null,
    textRegionH: null,
    detectedRegions: null,
    publishTitle: null,
    publishDescription: null,
    publishHashtags: null,
    originalVideo: null,
    processedVideo: null,
    thumbnail: null,
    publishedProfileId: null,
    publishedPlatform: null,
    publishedAt: null,
    publishError: null,
    errorMessage: null,
    errorStage: null,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateReelStatus(
  id: string,
  status: ReelStatus,
  extra?: Partial<Omit<ReelRow, 'id' | 'createdAt'>>,
): Reel | null {
  const now = new Date().toISOString();

  db.update(reelsTable)
    .set({ status, updatedAt: now, ...extra })
    .where(eq(reelsTable.id, id))
    .run();

  return getReelById(id);
}

export function updateReelText(id: string, text: string): Reel | null {
  const now = new Date().toISOString();

  db.update(reelsTable)
    .set({ finalText: text, updatedAt: now })
    .where(eq(reelsTable.id, id))
    .run();

  return getReelById(id);
}

export function updateReelError(
  id: string,
  stage: string,
  message: string,
): Reel | null {
  const now = new Date().toISOString();
  const reel = getReelById(id);
  if (!reel) return null;

  db.update(reelsTable)
    .set({
      status: 'error',
      errorStage: stage,
      errorMessage: message,
      retryCount: reel.retryCount + 1,
      updatedAt: now,
    })
    .where(eq(reelsTable.id, id))
    .run();

  return getReelById(id);
}

export function deleteReel(id: string): boolean {
  const reel = getReelById(id);
  if (!reel) return false;

  db.delete(reelsTable).where(eq(reelsTable.id, id)).run();

  const reelDir = getReelDirectory(id);
  if (fs.existsSync(reelDir)) {
    fs.rmSync(reelDir, { recursive: true, force: true });
  }

  return true;
}
