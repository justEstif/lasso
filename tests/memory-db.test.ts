import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { runMigrations } from '../src/db/migrations.ts';
import {
  countReflections,
  countSnapshots,
  createReflection,
  createSnapshot,
  listReflections,
  listSnapshots,
  parseSourceSnapshotIds,
  searchSnapshots,
} from '../src/observers/memory/db.ts';

function expectMemoryRecords(db: Database) {
  expect(countSnapshots(db)).toBe(1);
  expect(countReflections(db)).toBe(1);
  expect(listSnapshots(db)[0]?.content).toBe('Remember this convention.');
  expect(listReflections(db)[0]?.consolidated_content).toBe('Consolidated memory.');
}

function memoryDb() {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

describe('memory repository', () => {
  test('creates snapshots and reflections', () => {
    const db = memoryDb();

    const snapshot = createSnapshot(db, {
      content: 'Remember this convention.',
      scope: 'thread',
    });
    const reflection = createReflection(db, {
      consolidatedContent: 'Consolidated memory.',
      sourceSnapshotIds: [snapshot.id],
    });

    expectMemoryRecords(db);
    expect(parseSourceSnapshotIds(reflection)).toEqual([snapshot.id]);
  });

  test('deduplicates repeated snapshots and ranks focused context', () => {
    const db = memoryDb();
    const first = createSnapshot(db, {
      content: 'User is migrating dotfiles to Nix with home-manager and nix-darwin.',
      scope: 'thread',
    });
    const duplicate = createSnapshot(db, {
      content: 'User wants to migrate dotfiles to Nix using home-manager plus nix-darwin.',
      scope: 'thread',
    });
    createSnapshot(db, {
      content: 'Project prefers Bun APIs for file IO.',
      scope: 'thread',
    });

    expect(duplicate.id).toBe(first.id);
    expect(countSnapshots(db)).toBe(2);
    expect(listSnapshots(db).find((snapshot) => snapshot.id === first.id)?.seen_count).toBe(2);
    expect(searchSnapshots(db, 'Bun file IO')).toHaveLength(1);
    expect(searchSnapshots(db, 'Bun file IO')[0]?.content).toContain('Bun APIs');
  });
});
