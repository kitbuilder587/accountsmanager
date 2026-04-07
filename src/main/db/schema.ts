import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const managedProfilesTable = sqliteTable('managed_profiles', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(),
  accountLabel: text('account_label').notNull(),
  note: text('note'),
  profileDir: text('profile_dir').notNull(),
  proxy: text('proxy'),
  fingerprint: text('fingerprint'),
  status: text('status').notNull().default('active'),
  loginStatus: text('login_status').notNull().default('logged_out'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ManagedProfileRow = typeof managedProfilesTable.$inferSelect;
export type NewManagedProfileRow = typeof managedProfilesTable.$inferInsert;

export const publishJobsTable = sqliteTable('publish_jobs', {
  id: text('id').primaryKey(),
  reelId: text('reel_id').notNull(),
  profileId: text('profile_id').notNull(),
  platform: text('platform').notNull(),
  status: text('status').notNull().default('pending'),
  scheduledAt: text('scheduled_at'),
  publishedAt: text('published_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type PublishJobRow = typeof publishJobsTable.$inferSelect;
export type NewPublishJobRow = typeof publishJobsTable.$inferInsert;
