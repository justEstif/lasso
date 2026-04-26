import { describe, expect, test } from 'bun:test';

import { defaultConfig } from '../src/config/load.ts';
import { createEntry } from '../src/observers/lint/db.ts';
import { buildLintStatusModel } from '../src/observers/lint/status.ts';
import { createEntries, createSnapshot } from '../src/observers/memory/db.ts';
import { buildMemoryStatusModel } from '../src/observers/memory/status.ts';
import { testDb } from './helpers/db.ts';

async function addMemorySnapshot(db: Awaited<ReturnType<typeof testDb>>) {
  const snapshot = await createSnapshot(db, {
    content: '- 🔴 [decision] Use Bun',
    scope: 'thread',
  });
  await createEntries(db, {
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

async function addStatusedLintEntry(
  db: Awaited<ReturnType<typeof testDb>>,
  status: 'accepted' | 'proposed',
) {
  await createEntry(db, {
    affected_paths: [],
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

describe('observer status models', () => {
  test('builds lint status once for CLI and TUI surfaces', async () => {
    const db = await testDb();
    await addStatusedLintEntry(db, 'proposed');
    await addStatusedLintEntry(db, 'accepted');

    const model = await buildLintStatusModel(db, defaultConfig);
    expect(model.total).toBe(2);
    expect(model.counts.proposed).toBe(1);
    expect(model.counts.accepted).toBe(1);
    expect(model.saturation.activeCount).toBe(1);
  });

  test('builds memory status once for CLI and TUI surfaces', async () => {
    const db = await testDb();
    await addMemorySnapshot(db);

    const model = await buildMemoryStatusModel(db);
    expect(model.snapshots).toBe(1);
    expect(model.entries).toBe(1);
    expect(model.recentSnapshots[0]?.content).toContain('Use Bun');
  });
});
