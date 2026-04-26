import { describe, expect, test } from 'bun:test';

import { getMemoryDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations';
import {
  getDefaultTemplate,
  getWorkingMemory,
  listAllWorkingMemory,
  removeWorkingMemory,
  upsertWorkingMemory,
} from '../src/observers/memory/working-db.ts';

function workingDb() {
  const db = getMemoryDb();
  runMigrations(db);
  return db;
}

describe('working memory upsert create', () => {
  test('creates a new working memory record', () => {
    const db = workingDb();

    const record = upsertWorkingMemory(db, {
      content: '# Working Memory\n\n## Project\n- Name: lasso',
    });

    expect(record.id).toBeTruthy();
    expect(record.content).toContain('lasso');
    expect(record.updated_at).toBeTruthy();
  });

  test('creates separate records for different scopes', () => {
    const db = workingDb();

    upsertWorkingMemory(db, { content: 'Thread content', threadId: 'thread-1' });
    upsertWorkingMemory(db, { content: 'Resource content', resourceId: 'resource-1' });

    expect(listAllWorkingMemory(db)).toHaveLength(2);
  });
});

describe('working memory upsert update', () => {
  test('updates existing record when scope matches', () => {
    const db = workingDb();

    const first = upsertWorkingMemory(db, {
      content: 'Initial content',
      threadId: 'thread-1',
    });
    const second = upsertWorkingMemory(db, {
      content: 'Updated content',
      threadId: 'thread-1',
    });

    expect(second.id).toBe(first.id);
    expect(second.content).toBe('Updated content');
    expect(listAllWorkingMemory(db)).toHaveLength(1);
  });

  test('scopes by both resource and thread', () => {
    const db = workingDb();

    upsertWorkingMemory(db, {
      content: 'Combined scope',
      resourceId: 'res-1',
      threadId: 'thr-1',
    });

    const found = getWorkingMemory(db, { resourceId: 'res-1', threadId: 'thr-1' });
    expect(found?.content).toBe('Combined scope');

    const notFound = getWorkingMemory(db, { resourceId: 'res-1' });
    expect(notFound).toBeNull();
  });
});

describe('working memory retrieval', () => {
  test('returns null when no working memory exists', () => {
    const db = workingDb();
    expect(getWorkingMemory(db)).toBeNull();
  });

  test('retrieves by scope', () => {
    const db = workingDb();

    upsertWorkingMemory(db, { content: 'Thread A', threadId: 'thread-a' });
    upsertWorkingMemory(db, { content: 'Thread B', threadId: 'thread-b' });

    const result = getWorkingMemory(db, { threadId: 'thread-a' });
    expect(result?.content).toBe('Thread A');
  });

  test('lists all working memory records', () => {
    const db = workingDb();

    upsertWorkingMemory(db, { content: 'First' });
    upsertWorkingMemory(db, { content: 'Second', threadId: 't-1' });

    expect(listAllWorkingMemory(db)).toHaveLength(2);
  });
});

describe('working memory removal', () => {
  test('removes an existing record', () => {
    const db = workingDb();

    const record = upsertWorkingMemory(db, { content: 'To remove' });
    expect(removeWorkingMemory(db, record.id)).toBe(true);
    expect(getWorkingMemory(db)).toBeNull();
  });

  test('returns false for non-existent record', () => {
    const db = workingDb();
    expect(removeWorkingMemory(db, 'non-existent')).toBe(false);
  });
});

describe('default template', () => {
  test('provides a structured markdown template', () => {
    const template = getDefaultTemplate();
    expect(template).toContain('# Working Memory');
    expect(template).toContain('## Project');
    expect(template).toContain('## Current Task');
    expect(template).toContain('## Open Questions');
  });
});
