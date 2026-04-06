import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const managedProfilesTable = sqliteTable('managed_profiles', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(),
  accountLabel: text('account_label').notNull(),
  note: text('note'),
  profileDir: text('profile_dir').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type ManagedProfileRow = typeof managedProfilesTable.$inferSelect;
export type NewManagedProfileRow = typeof managedProfilesTable.$inferInsert;
