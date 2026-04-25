import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import type { ParsedEntry } from '../src/observers/memory/parser.ts';

import { runMigrations } from '../src/db/migrations.ts';
import {
  countEntries,
  createEntries,
  createSnapshot,
  listEntries,
  listEntriesBySnapshot,
  searchEntries,
} from '../src/observers/memory/db.ts';

function entryDb() {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

function sampleEntries(): ParsedEntry[] {
  return [
    {
      category: 'Preferences',
      content: 'User prefers Bun APIs over Node.js builtins',
      observedAt: '2025-04-25',
      priority: 'high',
    },
    {
      category: 'Preferences',
      content: 'Project uses strict TypeScript configuration',
      observedAt: '2025-04-24',
      priority: 'medium',
    },
    {
      category: 'Architecture',
      content: 'Considering migration to Drizzle ORM',
      observedAt: '2025-04-23',
      priority: 'low',
    },
  ];
}

function seedEntries(db: Database) {
  const snapshot = createSnapshot(db, { content: 'test', scope: 'thread' });
  createEntries(db, { entries: sampleEntries(), snapshotId: snapshot.id });
  return snapshot;
}

describe('entry creation and listing', () => {
  test('creates and lists entries for a snapshot', () => {
    const db = entryDb();
    const snapshot = seedEntries(db);

    expect(countEntries(db)).toBe(3);

    const listed = listEntries(db);
    expect(listed).toHaveLength(3);
    expect(listed[0]?.observed_at).toBe('2025-04-25');
    expect(listed[2]?.observed_at).toBe('2025-04-23');

    const bySnapshot = listEntriesBySnapshot(db, snapshot.id);
    expect(bySnapshot).toHaveLength(3);
  });
});

describe('entry priority filtering', () => {
  test('filters entries by priority', () => {
    const db = entryDb();
    seedEntries(db);

    const high = listEntries(db, { priority: 'high' });
    expect(high).toHaveLength(1);
    expect(high[0]?.priority).toBe('high');

    const medium = listEntries(db, { priority: 'medium' });
    expect(medium).toHaveLength(1);

    const low = listEntries(db, { priority: 'low' });
    expect(low).toHaveLength(1);
  });
});

describe('entry date filtering', () => {
  test('filters entries by date range', () => {
    const db = entryDb();
    seedEntries(db);

    const after = listEntries(db, { after: '2025-04-24' });
    expect(after).toHaveLength(2);

    const before = listEntries(db, { before: '2025-04-24' });
    expect(before).toHaveLength(2);

    const range = listEntries(db, { after: '2025-04-24', before: '2025-04-24' });
    expect(range).toHaveLength(1);
    expect(range[0]?.observed_at).toBe('2025-04-24');
  });
});

describe('entry snapshot scoping', () => {
  test('lists entries by snapshot and counts correctly', () => {
    const db = entryDb();
    const first = createSnapshot(db, { content: 'first', scope: 'thread' });
    const second = createSnapshot(db, { content: 'second', scope: 'thread' });

    createEntries(db, { entries: sampleEntries(), snapshotId: first.id });
    createEntries(db, {
      entries: [
        { category: 'Test', content: 'Extra entry', observedAt: '2025-04-25', priority: 'high' },
      ],
      snapshotId: second.id,
    });

    expect(listEntriesBySnapshot(db, first.id)).toHaveLength(3);
    expect(listEntriesBySnapshot(db, second.id)).toHaveLength(1);
    expect(countEntries(db)).toBe(4);
  });
});

describe('entry search', () => {
  test('searches entries by content tokens', () => {
    const db = entryDb();
    seedEntries(db);

    const results = searchEntries(db, 'Bun APIs');
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain('Bun APIs');
  });
});
