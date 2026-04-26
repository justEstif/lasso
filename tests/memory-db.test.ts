import { describe, expect, test } from 'bun:test';

import { testDb } from './helpers/db.ts';
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

async function expectMemoryRecords(db: Awaited<ReturnType<typeof testDb>>) {
  expect(await countSnapshots(db)).toBe(1);
  expect(await countReflections(db)).toBe(1);
  expect((await listSnapshots(db))[0]?.content).toBe('Remember this convention.');
  expect((await listReflections(db))[0]?.consolidated_content).toBe('Consolidated memory.');
}

async function memoryDb() {
  return testDb();
}

describe('memory repository', () => {
  test('creates snapshots and reflections', async () => {
    const db = await memoryDb();

    const snapshot = await createSnapshot(db, {
      content: 'Remember this convention.',
      scope: 'thread',
    });
    const reflection = await createReflection(db, {
      consolidatedContent: 'Consolidated memory.',
      sourceSnapshotIds: [snapshot.id],
    });

    await expectMemoryRecords(db);
    expect(parseSourceSnapshotIds(reflection)).toEqual([snapshot.id]);
  });

  test('deduplicates repeated snapshots and ranks focused context', async () => {
    const db = await memoryDb();
    const first = await createSnapshot(db, {
      content: 'User is migrating dotfiles to Nix with home-manager and nix-darwin.',
      scope: 'thread',
    });
    const duplicate = await createSnapshot(db, {
      content: 'User wants to migrate dotfiles to Nix using home-manager plus nix-darwin.',
      scope: 'thread',
    });
    await createSnapshot(db, {
      content: 'Project prefers Bun APIs for file IO.',
      scope: 'thread',
    });

    expect(duplicate.id).toBe(first.id);
    expect(await countSnapshots(db)).toBe(2);
    expect((await listSnapshots(db)).find((snapshot) => snapshot.id === first.id)?.seen_count).toBe(
      2,
    );
    const searchResults = await searchSnapshots(db, 'Bun file IO');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.content).toContain('Bun APIs');
  });
});

describe('reflection token threshold', () => {
  test('checkShouldReflect returns needed when threshold exceeded', async () => {
    const db = await memoryDb();

    const below = await checkShouldReflect(db, 'thread', 40_000);
    expect(below.needed).toBe(false);
    expect(below.lastObserved).toBe(0);

    await recordObservationTokenCount(db, 'thread', 20_000);
    const mid = await checkShouldReflect(db, 'thread', 40_000);
    expect(mid.needed).toBe(false);
    expect(mid.lastObserved).toBe(20_000);

    await recordObservationTokenCount(db, 'thread', 45_000);
    const exceeded = await checkShouldReflect(db, 'thread', 40_000);
    expect(exceeded.needed).toBe(true);
    expect(exceeded.lastObserved).toBe(45_000);
  });
});
