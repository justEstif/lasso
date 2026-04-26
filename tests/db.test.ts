import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDb, getDb, getMemoryDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations';
import { lintScanRuns, memorySnapshots } from '../src/db/schema';

describe('Database Persistence', () => {
  // Use OS temp dir to avoid findProjectRoot walking up into the real project
  const tmpDir = path.join(tmpdir(), 'lasso-test-db');

  test('getDb creates database directory', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    await mkdir(tmpDir, { recursive: true });

    const db = getDb(tmpDir);
    expect(db).toBeTruthy();

    closeDb();
    await rm(tmpDir, { force: true, recursive: true });
  });

  test('getDb uses ancestor project database from subdirectories', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    const projectRoot = path.join(tmpDir, 'project');
    const nested = path.join(projectRoot, 'src', 'nested');
    await mkdir(path.join(projectRoot, '.lasso'), { recursive: true });
    await mkdir(nested, { recursive: true });
    await Bun.write(path.join(projectRoot, '.lasso', 'config.json'), '{}');

    closeDb();
    const db = getDb(nested);
    expect(db).toBeTruthy();
    closeDb();

    // The DB file should exist at the project root, not the nested directory
    const dbAtProject = await Bun.file(path.join(projectRoot, '.lasso', 'db.sqlite')).exists();
    const dbAtNested = await Bun.file(path.join(nested, '.lasso', 'db.sqlite')).exists();
    expect(dbAtProject).toBe(true);
    expect(dbAtNested).toBe(false);

    await rm(tmpDir, { force: true, recursive: true });
  });
});

describe('Database migration schema', () => {
  test('runMigrations applies schema properly and creates tables', () => {
    const db = getMemoryDb();
    runMigrations(db);

    // If migrations ran, we can select from application tables without error
    const scanRuns = db.select().from(lintScanRuns).all();
    expect(scanRuns).toEqual([]);

    const snapshots = db.select().from(memorySnapshots).all();
    expect(snapshots).toEqual([]);
  });
});

describe('Database migration journal', () => {
  test('runMigrations is idempotent', () => {
    const db = getMemoryDb();

    runMigrations(db);

    // Second run should not throw
    runMigrations(db);

    // Verify tables still work
    const scanRuns = db.select().from(lintScanRuns).all();
    expect(scanRuns).toEqual([]);
  });
});
