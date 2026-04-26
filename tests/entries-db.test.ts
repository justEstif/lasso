import { describe, expect, test } from 'bun:test';

import type { ParsedEntry } from '../src/observers/memory/parser.ts';

import { testDb } from './helpers/db.ts';
import {
  countEntries,
  createEntries,
  createSnapshot,
  listEntries,
  listEntriesBySnapshot,
  searchEntries,
} from '../src/observers/memory/db.ts';

async function entryDb() {
  return testDb();
}

function sampleEntries(): ParsedEntry[] {
  return [
    {
      category: 'Preferences',
      content: 'User prefers Bun APIs over Node.js builtins',
      observedAt: '2025-04-25',
      priority: 'high',
      referencedDate: null,
      relativeOffset: null,
    },
    {
      category: 'Preferences',
      content: 'Project uses strict TypeScript configuration',
      observedAt: '2025-04-24',
      priority: 'medium',
      referencedDate: null,
      relativeOffset: null,
    },
    {
      category: 'Architecture',
      content: 'Considering migration to Drizzle ORM',
      observedAt: '2025-04-23',
      priority: 'low',
      referencedDate: null,
      relativeOffset: null,
    },
  ];
}

async function seedEntries(db: Awaited<ReturnType<typeof testDb>>) {
  const snapshot = await createSnapshot(db, { content: 'test', scope: 'thread' });
  await createEntries(db, { entries: sampleEntries(), snapshotId: snapshot.id });
  return snapshot;
}

describe('entry creation and listing', () => {
  test('creates and lists entries for a snapshot', async () => {
    const db = await entryDb();
    const snapshot = await seedEntries(db);

    expect(await countEntries(db)).toBe(3);

    const listed = await listEntries(db);
    expect(listed).toHaveLength(3);
    expect(listed[0]?.observed_at).toBe('2025-04-25');
    expect(listed[2]?.observed_at).toBe('2025-04-23');

    const bySnapshot = await listEntriesBySnapshot(db, snapshot.id);
    expect(bySnapshot).toHaveLength(3);
  });
});

describe('entry priority filtering', () => {
  test('filters entries by priority', async () => {
    const db = await entryDb();
    await seedEntries(db);

    const high = await listEntries(db, { priority: 'high' });
    expect(high).toHaveLength(1);
    expect(high[0]?.priority).toBe('high');

    const medium = await listEntries(db, { priority: 'medium' });
    expect(medium).toHaveLength(1);

    const low = await listEntries(db, { priority: 'low' });
    expect(low).toHaveLength(1);
  });
});

describe('entry date filtering', () => {
  test('filters entries by date range', async () => {
    const db = await entryDb();
    await seedEntries(db);

    const after = await listEntries(db, { after: '2025-04-24' });
    expect(after).toHaveLength(2);

    const before = await listEntries(db, { before: '2025-04-24' });
    expect(before).toHaveLength(2);

    const range = await listEntries(db, { after: '2025-04-24', before: '2025-04-24' });
    expect(range).toHaveLength(1);
    expect(range[0]?.observed_at).toBe('2025-04-24');
  });
});

describe('entry snapshot scoping', () => {
  test('lists entries by snapshot and counts correctly', async () => {
    const db = await entryDb();
    const first = await createSnapshot(db, { content: 'first', scope: 'thread' });
    const second = await createSnapshot(db, { content: 'second', scope: 'thread' });

    await createEntries(db, { entries: sampleEntries(), snapshotId: first.id });
    await createEntries(db, {
      entries: [
        {
          category: 'Test',
          content: 'Extra entry',
          observedAt: '2025-04-25',
          priority: 'high',
          referencedDate: null,
          relativeOffset: null,
        },
      ],
      snapshotId: second.id,
    });

    expect(await listEntriesBySnapshot(db, first.id)).toHaveLength(3);
    expect(await listEntriesBySnapshot(db, second.id)).toHaveLength(1);
    expect(await countEntries(db)).toBe(4);
  });
});

describe('entry search', () => {
  test('searches entries by content tokens', async () => {
    const db = await entryDb();
    await seedEntries(db);

    const results = await searchEntries(db, 'Bun APIs');
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain('Bun APIs');
  });
});

describe('temporal anchoring', () => {
  test('stores referenced_date and relative_offset in entries', async () => {
    const db = await entryDb();
    const snapshot = await createSnapshot(db, { content: 'temporal test', scope: 'thread' });

    await createEntries(db, {
      entries: [
        {
          category: 'Schedule',
          content: 'Flight to conference',
          observedAt: '2025-04-25',
          priority: 'high',
          referencedDate: '2025-01-31',
          relativeOffset: null,
        },
        {
          category: 'Schedule',
          content: 'Follow-up meeting',
          observedAt: '2025-04-25',
          priority: 'medium',
          referencedDate: null,
          relativeOffset: 2,
        },
      ],
      snapshotId: snapshot.id,
    });

    const entries = await listEntries(db);
    expect(entries).toHaveLength(2);

    const flight = entries.find((e) => e.content === 'Flight to conference');
    expect(flight?.referenced_date).toBe('2025-01-31');
    expect(flight?.relative_offset).toBeNull();

    const meeting = entries.find((e) => e.content === 'Follow-up meeting');
    expect(meeting?.referenced_date).toBeNull();
    expect(meeting?.relative_offset).toBe(2);
  });
});

describe('temporal sorting by referenced_date', () => {
  test('sorts by referenced_date ascending', async () => {
    const db = await entryDb();
    const snapshot = await createSnapshot(db, { content: 'sort test', scope: 'thread' });

    await createEntries(db, {
      entries: [
        {
          category: 'Dates',
          content: 'Later event',
          observedAt: '2025-04-25',
          priority: 'low',
          referencedDate: '2025-06-01',
          relativeOffset: null,
        },
        {
          category: 'Dates',
          content: 'Earlier event',
          observedAt: '2025-04-25',
          priority: 'low',
          referencedDate: '2025-02-01',
          relativeOffset: null,
        },
      ],
      snapshotId: snapshot.id,
    });

    const sorted = await listEntries(db, { sortField: 'referenced_date', sortOrder: 'asc' });
    expect(sorted[0]?.content).toBe('Earlier event');
    expect(sorted[1]?.content).toBe('Later event');
  });
});

describe('temporal sorting by created_at', () => {
  test('sorts by created_at ascending', async () => {
    const db = await entryDb();
    await seedEntries(db);

    const sorted = await listEntries(db, { sortField: 'created_at', sortOrder: 'asc' });
    expect(sorted.length).toBeGreaterThan(0);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.created_at >= sorted[i - 1]!.created_at).toBe(true);
    }
  });
});
