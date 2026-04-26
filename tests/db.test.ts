import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { closeDb, getDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations.ts';
import { testDb } from './helpers/db.ts';

describe('Database Persistence', () => {
  const tmpDir = path.join(process.cwd(), 'tests', '.tmp_test_db');

  test('getDb creates PGlite database directory', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    await mkdir(tmpDir, { recursive: true });

    const db = await getDb(tmpDir);
    expect(db).toBeTruthy();
    await closeDb();
    await rm(tmpDir, { force: true, recursive: true });
  });

  test('getDb uses ancestor project database from subdirectories', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    const projectRoot = path.join(tmpDir, 'project');
    const nested = path.join(projectRoot, 'src', 'nested');
    await mkdir(path.join(projectRoot, '.lasso'), { recursive: true });
    await mkdir(nested, { recursive: true });
    await Bun.write(path.join(projectRoot, '.lasso', 'config.json'), '{}');

    await getDb(nested);
    await closeDb();

    expect(await Bun.file(path.join(nested, '.lasso', 'pglite')).exists()).toBe(false);

    await rm(tmpDir, { force: true, recursive: true });
  });
});

describe('Database migration schema', () => {
  test('runMigrations applies schema properly and creates tables', async () => {
    const db = await testDb();
    const { rows: tables } = await db.$client.query(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname IN ('public','drizzle')",
    );
    const tableNames = (tables as { name: string }[]).map((t) => t.name);

    expect(tableNames).toContain('__drizzle_migrations');
    expect(tableNames).toContain('lint_scan_runs');
    expect(tableNames).toContain('memory_snapshots');
  });
});

describe('Database migration journal', () => {
  test('runMigrations records Drizzle migrations correctly', async () => {
    const db = await testDb();
    const { rows: migrations } = await db.$client.query(
      'SELECT * FROM drizzle.__drizzle_migrations',
    );
    expect(migrations.length).toBe(1);
    expect((migrations as { hash: string }[])[0]?.hash).toBeString();
  });

  test('runMigrations is idempotent', async () => {
    const db = await testDb();
    await runMigrations(db);
    let result = await db.$client.query('SELECT * FROM drizzle.__drizzle_migrations');
    expect(result.rows.length).toBe(1);
    await runMigrations(db);
    result = await db.$client.query('SELECT * FROM drizzle.__drizzle_migrations');
    expect(result.rows.length).toBe(1);
  });
});
