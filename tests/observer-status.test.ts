import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, test } from 'bun:test';

import { defaultConfig } from '../src/config/load.ts';
import { runMigrations } from '../src/db/migrations.ts';
import { createEntry } from '../src/observers/lint/db.ts';
import { buildLintStatusModel } from '../src/observers/lint/status.ts';
import { createEntries, createSnapshot } from '../src/observers/memory/db.ts';
import { buildMemoryStatusModel } from '../src/observers/memory/status.ts';

const openDbs: Database[] = [];

function addMemorySnapshot(db: Database) {
  const snapshot = createSnapshot(db, { content: '- 🔴 [decision] Use Bun', scope: 'thread' });
  createEntries(db, {
    entries: [
      {
        category: 'decision',
        content: 'Use Bun',
        observedAt: '2026-04-25T00:00:00.000Z',
        priority: 'high',
        referencedDate: null,
        relativeOffset: null,
      },
    ],
    snapshotId: snapshot.id,
  });
}

function addStatusedLintEntry(db: Database, status: 'accepted' | 'proposed') {
  createEntry(db, {
    affected_paths: JSON.stringify([]),
    category: null,
    description: status === 'proposed' ? 'Prefer Bun APIs' : 'Remove compatibility aliases',
    detector_version: 'test',
    proposed_form: null,
    referenced_date: null,
    relative_offset: null,
    severity: 'medium',
    source_excerpt: null,
    status,
  });
}

function testDb() {
  const db = new Database(':memory:');
  openDbs.push(db);
  runMigrations(db);
  return db;
}

afterEach(() => {
  for (const db of openDbs.splice(0)) db.close();
});

describe('observer status models', () => {
  test('builds lint status once for CLI and TUI surfaces', () => {
    const db = testDb();
    addStatusedLintEntry(db, 'proposed');
    addStatusedLintEntry(db, 'accepted');

    const status = buildLintStatusModel(db, defaultConfig);

    expect(status.counts.proposed).toBe(1);
    expect(status.counts.accepted).toBe(1);
    expect(status.saturation.saturated).toBe(false);
    expect(status.total).toBe(2);
  });

  test('builds memory status once for CLI and TUI surfaces', () => {
    const db = testDb();
    addMemorySnapshot(db);

    const status = buildMemoryStatusModel(db);

    expect(status.snapshots).toBe(1);
    expect(status.entries).toBe(1);
    expect(status.lastSnapshot).not.toBe('never');
    expect(status.recentSnapshots).toHaveLength(1);
  });
});
