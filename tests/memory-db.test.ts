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
} from '../src/observers/memory/db.ts';

describe('memory repository', () => {
  test('creates snapshots and reflections', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const snapshot = createSnapshot(db, {
      content: 'Remember this convention.',
      scope: 'thread',
    });
    const reflection = createReflection(db, {
      consolidatedContent: 'Consolidated memory.',
      sourceSnapshotIds: [snapshot.id],
    });

    expect(countSnapshots(db)).toBe(1);
    expect(countReflections(db)).toBe(1);
    expect(listSnapshots(db)[0]?.content).toBe('Remember this convention.');
    expect(listReflections(db)[0]?.consolidated_content).toBe('Consolidated memory.');
    expect(parseSourceSnapshotIds(reflection)).toEqual([snapshot.id]);
  });
});
