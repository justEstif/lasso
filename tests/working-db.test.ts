import { describe, expect, test } from 'bun:test';

import { testDb } from './helpers/db.ts';
import {
  getDefaultTemplate,
  getWorkingMemory,
  listAllWorkingMemory,
  removeWorkingMemory,
  upsertWorkingMemory,
} from '../src/observers/memory/working-db.ts';

async function workingDb() {
  return testDb();
}

describe('working memory upsert create', () => {
  test('creates a new working memory record', async () => {
    const db = await workingDb();

    const record = await upsertWorkingMemory(db, {
      content: '# Working Memory\n\n## Project\n- Name: lasso',
    });

    expect(record.id).toBeTruthy();
    expect(record.content).toContain('lasso');
    expect(record.updated_at).toBeTruthy();
  });

  test('creates separate records for different scopes', async () => {
    const db = await workingDb();

    await upsertWorkingMemory(db, { content: 'Thread content', threadId: 'thread-1' });
    await upsertWorkingMemory(db, { content: 'Resource content', resourceId: 'resource-1' });

    expect(await listAllWorkingMemory(db)).toHaveLength(2);
  });
});

describe('working memory upsert update', () => {
  test('updates existing record when scope matches', async () => {
    const db = await workingDb();

    const first = await upsertWorkingMemory(db, {
      content: 'Initial content',
      threadId: 'thread-1',
    });
    const second = await upsertWorkingMemory(db, {
      content: 'Updated content',
      threadId: 'thread-1',
    });

    expect(second.id).toBe(first.id);
    expect(second.content).toBe('Updated content');
    expect(await listAllWorkingMemory(db)).toHaveLength(1);
  });

  test('scopes by both resource and thread', async () => {
    const db = await workingDb();

    await upsertWorkingMemory(db, {
      content: 'Combined scope',
      resourceId: 'res-1',
      threadId: 'thr-1',
    });

    const found = await getWorkingMemory(db, { resourceId: 'res-1', threadId: 'thr-1' });
    expect(found?.content).toBe('Combined scope');

    const notFound = await getWorkingMemory(db, { resourceId: 'res-1' });
    expect(notFound).toBeNull();
  });
});

describe('working memory retrieval', () => {
  test('returns null when no working memory exists', async () => {
    const db = await workingDb();
    expect(await getWorkingMemory(db)).toBeNull();
  });

  test('retrieves by scope', async () => {
    const db = await workingDb();

    await upsertWorkingMemory(db, { content: 'Thread A', threadId: 'thread-a' });
    await upsertWorkingMemory(db, { content: 'Thread B', threadId: 'thread-b' });

    const result = await getWorkingMemory(db, { threadId: 'thread-a' });
    expect(result?.content).toBe('Thread A');
  });

  test('lists all working memory records', async () => {
    const db = await workingDb();

    await upsertWorkingMemory(db, { content: 'First' });
    await upsertWorkingMemory(db, { content: 'Second', threadId: 't-1' });

    expect(await listAllWorkingMemory(db)).toHaveLength(2);
  });
});

describe('working memory removal', () => {
  test('removes an existing record', async () => {
    const db = await workingDb();

    const record = await upsertWorkingMemory(db, { content: 'To remove' });
    expect(await removeWorkingMemory(db, record.id)).toBe(true);
    expect(await getWorkingMemory(db)).toBeNull();
  });

  test('returns false for non-existent record', async () => {
    const db = await workingDb();
    expect(await removeWorkingMemory(db, 'non-existent')).toBe(false);
  });
});

describe('default template', () => {
  test('provides a structured markdown template', async () => {
    const template = getDefaultTemplate();
    expect(template).toContain('# Working Memory');
    expect(template).toContain('## Project');
    expect(template).toContain('## Current Task');
    expect(template).toContain('## Open Questions');
  });
});
