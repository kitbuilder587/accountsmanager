import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const reelsTable = sqliteTable('reels', {
  id: text('id').primaryKey(),
  sourceUrl: text('source_url').notNull(),
  telegramChatId: text('telegram_chat_id'),
  telegramMessageId: text('telegram_message_id'),
  status: text('status').notNull().default('pending'),
  originalText: text('original_text'),
  customText: text('custom_text'),
  generatedText: text('generated_text'),
  finalText: text('final_text'),
  textRegionX: integer('text_region_x'),
  textRegionY: integer('text_region_y'),
  textRegionW: integer('text_region_w'),
  textRegionH: integer('text_region_h'),
  detectedRegions: text('detected_regions'),
  originalVideo: text('original_video'),
  processedVideo: text('processed_video'),
  thumbnail: text('thumbnail'),
  publishedProfileId: text('published_profile_id'),
  publishedPlatform: text('published_platform'),
  publishedAt: text('published_at'),
  publishError: text('publish_error'),
  errorMessage: text('error_message'),
  errorStage: text('error_stage'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ReelRow = typeof reelsTable.$inferSelect;
export type NewReelRow = typeof reelsTable.$inferInsert;
