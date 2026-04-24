import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

let dbInstance: Database | null = null;

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function getDb(cwd: string = process.cwd()): Database {
  if (dbInstance) return dbInstance;

  const lassoDir = path.join(cwd, '.lasso');
  const dbPath = path.join(lassoDir, 'db.sqlite');
  mkdirSync(lassoDir, { recursive: true });

  // Create database instance
  dbInstance = new Database(dbPath);

  // Enable WAL mode for better concurrency
  dbInstance.run('PRAGMA journal_mode = WAL;');

  return dbInstance;
}
