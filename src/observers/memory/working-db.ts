import { Database } from 'bun:sqlite';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import { workingMemory } from '../../db/schema.ts';

export interface UpsertWorkingMemoryInput {
  content: string;
  resourceId?: string;
  threadId?: string;
}

export type WorkingMemoryRecord = typeof workingMemory.$inferSelect;

export interface WorkingMemoryScope {
  resourceId?: string;
  threadId?: string;
}

const DEFAULT_TEMPLATE = `# Working Memory

## Project
- Name: 
- Tech stack: 

## Current Task
- 

## Open Questions
- 
`;

export function getDefaultTemplate(): string {
  return DEFAULT_TEMPLATE;
}

export function getWorkingMemory(
  db: Database,
  options?: WorkingMemoryScope,
): null | WorkingMemoryRecord {
  const conditions = buildKeyMatch(options);
  const query = drizzle(db).select().from(workingMemory);
  if (conditions) query.where(conditions);

  return query.get() ?? null;
}

export function listAllWorkingMemory(db: Database): WorkingMemoryRecord[] {
  return drizzle(db).select().from(workingMemory).all();
}

export function removeWorkingMemory(db: Database, id: string): boolean {
  const existing = drizzle(db).select().from(workingMemory).where(eq(workingMemory.id, id)).get();
  if (!existing) return false;

  drizzle(db).delete(workingMemory).where(eq(workingMemory.id, id)).run();
  return true;
}

export function upsertWorkingMemory(
  db: Database,
  input: UpsertWorkingMemoryInput,
): WorkingMemoryRecord {
  const existing = findExisting(db, input);
  const now = new Date().toISOString();

  if (existing) {
    drizzle(db)
      .update(workingMemory)
      .set({ content: input.content, updated_at: now })
      .where(eq(workingMemory.id, existing.id))
      .run();
    return { ...existing, content: input.content, updated_at: now };
  }

  const record = {
    content: input.content,
    id: crypto.randomUUID(),
    resource_id: input.resourceId ?? null,
    thread_id: input.threadId ?? null,
    updated_at: now,
  };

  drizzle(db).insert(workingMemory).values(record).run();
  return record;
}

function buildKeyMatch(options?: WorkingMemoryScope) {
  if (!options) return null;
  const conditions = [];
  if (options.resourceId) {
    conditions.push(eq(workingMemory.resource_id, options.resourceId));
  } else {
    conditions.push(isNull(workingMemory.resource_id));
  }
  if (options.threadId) {
    conditions.push(eq(workingMemory.thread_id, options.threadId));
  } else {
    conditions.push(isNull(workingMemory.thread_id));
  }
  return and(...conditions);
}

function findExisting(db: Database, input: WorkingMemoryScope): null | WorkingMemoryRecord {
  const conditions = buildKeyMatch(input);
  if (!conditions) return null;
  return drizzle(db).select().from(workingMemory).where(conditions).get() ?? null;
}
