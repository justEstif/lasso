import { describe, expect, test } from 'bun:test';

import { getMemoryDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations';
import {
  checkShouldReflect,
  countReflections,
  countSnapshots,
  createReflection,
  createSnapshot,
  listReflections,
  listSnapshots,
  parseSourceSnapshotIds,
  recordObservationTokenCount,
  searchSnapshots,
} from '../src/observers/memory/db.ts';

function expectMemoryRecords(db: ReturnType<typeof memoryDb>) {
  expect(countSnapshots(db)).toBe(1);
  expect(countReflections(db)).toBe(1);
  expect(listSnapshots(db)[0]?.content).toBe('Remember this convention.');
  expect(listReflections(db)[0]?.consolidated_content).toBe('Consolidated memory.');
}

function memoryDb() {
  const db = getMemoryDb();
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

describe('reflection token threshold', () => {
  test('checkShouldReflect returns needed when threshold exceeded', () => {
    const db = memoryDb();

    const below = checkShouldReflect(db, 'thread', 40_000);
    expect(below.needed).toBe(false);
    expect(below.lastObserved).toBe(0);

    recordObservationTokenCount(db, 'thread', 20_000);
    const mid = checkShouldReflect(db, 'thread', 40_000);
    expect(mid.needed).toBe(false);
    expect(mid.lastObserved).toBe(20_000);

    recordObservationTokenCount(db, 'thread', 45_000);
    const exceeded = checkShouldReflect(db, 'thread', 40_000);
    expect(exceeded.needed).toBe(true);
    expect(exceeded.lastObserved).toBe(45_000);
  });
});
