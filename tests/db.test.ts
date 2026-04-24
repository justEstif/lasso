import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { closeDb, getDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations';

describe('Database Persistence', () => {
  const tmpDir = path.join(process.cwd(), 'tests', '.tmp_test_db');

  test('getDb creates database and enables WAL mode', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    await mkdir(tmpDir, { recursive: true });

    const db = getDb(tmpDir);
    expect(db).toBeInstanceOf(Database);

    const mode = db.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
    expect(mode.journal_mode.toLowerCase()).toBe('wal');

    closeDb();
    await rm(tmpDir, { force: true, recursive: true });
  });
});

describe('Database migration schema', () => {
  test('runMigrations applies schema properly and creates tables', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table';");
    const tables = tablesQuery.all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('__drizzle_migrations');
    expect(tableNames).toContain('lint_scan_runs');
    expect(tableNames).toContain('memory_snapshots');
  });
});

describe('Database migration journal', () => {
  test('runMigrations records Drizzle migrations correctly', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const migrations = db.prepare('SELECT * FROM __drizzle_migrations').all() as Record<
      string,
      unknown
    >[];
    expect(migrations.length).toBe(1);
    expect(migrations[0]?.hash).toBeString();
  });

  test('runMigrations is idempotent', () => {
    const db = new Database(':memory:');

    runMigrations(db);
    let migrations = db.prepare('SELECT * FROM __drizzle_migrations').all() as Record<
      string,
      unknown
    >[];
    expect(migrations.length).toBe(1);

    runMigrations(db);
    migrations = db.prepare('SELECT * FROM __drizzle_migrations').all() as Record<
      string,
      unknown
    >[];
    expect(migrations.length).toBe(1);
  });
});
