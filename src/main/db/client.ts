import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { getAppPaths } from '../services/app-paths.js';

const sqlite = new Database(getAppPaths().databaseFile);

sqlite.pragma('journal_mode = WAL');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS managed_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    platform TEXT NOT NULL,
    account_label TEXT NOT NULL,
    note TEXT,
    profile_dir TEXT NOT NULL,
    proxy TEXT,
    fingerprint TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    login_status TEXT NOT NULL DEFAULT 'logged_out',
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS reels (
    id TEXT PRIMARY KEY NOT NULL,
    source_url TEXT NOT NULL,
    telegram_chat_id TEXT,
    telegram_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    original_text TEXT,
    custom_text TEXT,
    generated_text TEXT,
    final_text TEXT,
    text_region_x INTEGER,
    text_region_y INTEGER,
    text_region_w INTEGER,
    text_region_h INTEGER,
    detected_regions TEXT,
    publish_title TEXT,
    publish_description TEXT,
    publish_hashtags TEXT,
    original_video TEXT,
    processed_video TEXT,
    thumbnail TEXT,
    published_profile_id TEXT,
    published_platform TEXT,
    published_at TEXT,
    publish_error TEXT,
    error_message TEXT,
    error_stage TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS publish_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    reel_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    scheduled_at TEXT,
    published_at TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migrations: add columns if missing
function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!cols.some(c => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

try {
  // reels migrations
  addColumnIfMissing('reels', 'detected_regions', 'TEXT');
  addColumnIfMissing('reels', 'publish_title', 'TEXT');
  addColumnIfMissing('reels', 'publish_description', 'TEXT');
  addColumnIfMissing('reels', 'publish_hashtags', 'TEXT');

  // managed_profiles migrations
  addColumnIfMissing('managed_profiles', 'proxy', 'TEXT');
  addColumnIfMissing('managed_profiles', 'fingerprint', 'TEXT');
  addColumnIfMissing('managed_profiles', 'status', "TEXT NOT NULL DEFAULT 'active'");
  addColumnIfMissing('managed_profiles', 'login_status', "TEXT NOT NULL DEFAULT 'logged_out'");
  addColumnIfMissing('managed_profiles', 'avatar_url', 'TEXT');
} catch { /* tables might not exist yet */ }

export const db = drizzle(sqlite);
export { sqlite };
