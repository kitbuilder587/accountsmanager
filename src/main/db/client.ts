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

export const db = drizzle(sqlite);
export { sqlite };
