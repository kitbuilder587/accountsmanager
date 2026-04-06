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

export const db = drizzle(sqlite);
export { sqlite };
