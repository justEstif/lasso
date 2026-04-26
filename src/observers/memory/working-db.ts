import { and, eq, isNull } from 'drizzle-orm';

import type { LassoDb } from '../../db/index.ts';

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

export async function getWorkingMemory(
  db: LassoDb,
  options?: WorkingMemoryScope,
): Promise<null | WorkingMemoryRecord> {
  const conditions = buildKeyMatch(options);
  const query = db.select().from(workingMemory);
  if (conditions) query.where(conditions);

  return (await query.limit(1))[0] ?? null;
}

export async function listAllWorkingMemory(db: LassoDb): Promise<WorkingMemoryRecord[]> {
  return await db.select().from(workingMemory);
}

export async function removeWorkingMemory(db: LassoDb, id: string): Promise<boolean> {
  const existing = (
    await db.select().from(workingMemory).where(eq(workingMemory.id, id)).limit(1)
  )[0];
  if (!existing) return false;

  await db.delete(workingMemory).where(eq(workingMemory.id, id));
  return true;
}

export async function upsertWorkingMemory(
  db: LassoDb,
  input: UpsertWorkingMemoryInput,
): Promise<WorkingMemoryRecord> {
  const existing = await findExisting(db, input);
  const now = new Date().toISOString();

  if (existing) {
    await db
      .update(workingMemory)
      .set({ content: input.content, updated_at: now })
      .where(eq(workingMemory.id, existing.id));
    return { ...existing, content: input.content, updated_at: now };
  }

  const record = {
    content: input.content,
    id: crypto.randomUUID(),
    resource_id: input.resourceId ?? null,
    thread_id: input.threadId ?? null,
    updated_at: now,
  };

  await db.insert(workingMemory).values(record);
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

async function findExisting(
  db: LassoDb,
  input: WorkingMemoryScope,
): Promise<null | WorkingMemoryRecord> {
  const conditions = buildKeyMatch(input);
  if (!conditions) return null;
  return (await db.select().from(workingMemory).where(conditions).limit(1))[0] ?? null;
}
