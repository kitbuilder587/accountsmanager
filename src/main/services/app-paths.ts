import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const APP_DATA_ROOT_OVERRIDE = 'ACCOUNTS_MANAGER_APP_DATA_ROOT';

export interface AppPaths {
  rootDir: string;
  dbDir: string;
  profilesDir: string;
  databaseFile: string;
  reelsDir: string;
  assetsDir: string;
}

let cachedAppPaths: AppPaths | null = null;

function resolveElectronUserDataPath(): string | null {
  if (!process.versions.electron) {
    return null;
  }

  const electron = require('electron') as typeof import('electron');

  return electron.app.getPath('userData');
}

function ensureDirectory(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function getAppPaths(): AppPaths {
  if (cachedAppPaths) {
    return cachedAppPaths;
  }

  const overrideRoot = process.env[APP_DATA_ROOT_OVERRIDE]?.trim();
  const rootDir = overrideRoot || resolveElectronUserDataPath() || path.resolve('.accountsmanager-dev');
  const dbDir = path.join(rootDir, 'db');
  const profilesDir = path.join(rootDir, 'profiles');
  const databaseFile = path.join(dbDir, 'accounts-manager.sqlite');
  const reelsDir = path.join(rootDir, 'reels');
  const assetsDir = path.join(rootDir, 'assets');

  ensureDirectory(dbDir);
  ensureDirectory(profilesDir);
  ensureDirectory(reelsDir);
  ensureDirectory(assetsDir);

  cachedAppPaths = {
    rootDir,
    dbDir,
    profilesDir,
    databaseFile,
    reelsDir,
    assetsDir,
  };

  return cachedAppPaths;
}

export function resetAppPathsForTests(): void {
  cachedAppPaths = null;
}
