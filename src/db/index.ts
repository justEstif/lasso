import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { resolveLassoPaths } from '../project/paths.ts';
import * as schema from './schema.ts';

/**
 * LassoDb is the database abstraction consumers work with.
 * Hides the concrete driver — swap drivers in this file, nowhere else.
 */
export type LassoDb = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: LassoDb | null = null;
let sqliteInstance: Database | null = null;

export function closeDb(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
  }
  dbInstance = null;
}

export function getDb(cwd: string = process.cwd()): LassoDb {
  if (dbInstance) return dbInstance;

  const { lassoDir } = resolveLassoPaths(cwd);
  const dbPath = path.join(lassoDir, 'db.sqlite');
  mkdirSync(lassoDir, { recursive: true });

  sqliteInstance = new Database(dbPath);
  sqliteInstance.run('PRAGMA journal_mode = WAL;');

  dbInstance = drizzle(sqliteInstance, { schema });
  return dbInstance;
}

/**
 * Creates an in-memory LassoDb for tests.
 * Each call creates a fresh database — use sparingly or share via test helpers.
 */
export function getMemoryDb(): LassoDb {
  return drizzle(new Database(':memory:'), { schema });
}
