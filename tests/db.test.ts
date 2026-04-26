import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDb, getDb, getMemoryDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations';
import { lintScanRuns, memorySnapshots } from '../src/db/schema';
import { resolveLassoPaths } from '../src/project/paths';

describe('Database Persistence', () => {
  // Use OS temp dir to avoid findProjectRoot walking up into the real project
  const tmpDir = path.join(tmpdir(), 'lasso-test-db');

  test('getDb creates database directory', () => {
    rmSync(tmpDir, { force: true, recursive: true });
    mkdirSync(tmpDir, { recursive: true });

    closeDb();
    const db = getDb(tmpDir);
    expect(db).toBeTruthy();
    closeDb();

    rmSync(tmpDir, { force: true, recursive: true });
  });

  test('resolveLassoPaths finds ancestor project from subdirectories', () => {
    rmSync(tmpDir, { force: true, recursive: true });
    const projectRoot = path.join(tmpDir, 'project');
    const nested = path.join(projectRoot, 'src', 'nested');
    mkdirSync(path.join(projectRoot, '.lasso'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(path.join(projectRoot, '.lasso', 'config.json'), '{}');

    expect(existsSync(path.join(projectRoot, '.lasso', 'config.json'))).toBe(true);

    const { lassoDir, projectRoot: resolvedRoot } = resolveLassoPaths(nested);
    expect(resolvedRoot).toBe(projectRoot);
    expect(lassoDir).toBe(path.join(projectRoot, '.lasso'));

    rmSync(tmpDir, { force: true, recursive: true });
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
