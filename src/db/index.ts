import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { resolveLassoPaths } from '../project/paths.ts';
import * as schema from './schema.ts';

const FTS5_SETUP_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS observation_entries_fts USING fts5(
  content,
  category,
  content='observation_entries',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS observation_entries_ai AFTER INSERT ON observation_entries BEGIN
  INSERT INTO observation_entries_fts(rowid, content, category)
  VALUES (new.rowid, new.content, new.category);
END;

CREATE TRIGGER IF NOT EXISTS observation_entries_ad AFTER DELETE ON observation_entries BEGIN
  INSERT INTO observation_entries_fts(observation_entries_fts, rowid, content, category)
  VALUES ('delete', old.rowid, old.content, old.category);
END;

CREATE TRIGGER IF NOT EXISTS observation_entries_au AFTER UPDATE ON observation_entries BEGIN
  INSERT INTO observation_entries_fts(observation_entries_fts, rowid, content, category)
  VALUES ('delete', old.rowid, old.content, old.category);
  INSERT INTO observation_entries_fts(rowid, content, category)
  VALUES (new.rowid, new.content, new.category);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS memory_snapshots_fts USING fts5(
  content,
  content='memory_snapshots',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS memory_snapshots_ai AFTER INSERT ON memory_snapshots BEGIN
  INSERT INTO memory_snapshots_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS memory_snapshots_ad AFTER DELETE ON memory_snapshots BEGIN
  INSERT INTO memory_snapshots_fts(memory_snapshots_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS memory_snapshots_au AFTER UPDATE ON memory_snapshots BEGIN
  INSERT INTO memory_snapshots_fts(memory_snapshots_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
  INSERT INTO memory_snapshots_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;
`;

/**
 * LassoDb is the database abstraction consumers work with.
 * Hides the concrete driver — swap drivers in this file, nowhere else.
 */
export type LassoDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Ensures FTS5 virtual tables and sync triggers exist.
 * Safe to call multiple times (uses IF NOT EXISTS).
 * Required for in-memory test DBs that skip the migration runner.
 */
export function ensureFtsIndexes(db: LassoDb): void {
  // Drizzle's run() can't handle multi-statement SQL with embedded semicolons
  // (e.g. trigger bodies), so we use the raw bun:sqlite client directly.
  const client = (db as unknown as { $client: Database }).$client;
  if (client) {
    client.run(FTS5_SETUP_SQL);
  }
}

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
