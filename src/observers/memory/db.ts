import { Database } from 'bun:sqlite';
import { desc, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import { memoryReflections, memorySnapshots } from '../../db/schema.ts';

export type MemoryScope = 'resource' | 'thread';
export type MemorySnapshot = typeof memorySnapshots.$inferSelect & { scope: MemoryScope };
export type MemoryReflection = typeof memoryReflections.$inferSelect;

export interface CreateSnapshotInput {
  content: string;
  scope: MemoryScope;
}

export interface CreateReflectionInput {
  consolidatedContent: string;
  sourceSnapshotIds: string[];
}

export function createSnapshot(db: Database, input: CreateSnapshotInput): MemorySnapshot {
  const now = new Date().toISOString();
  const snapshot = {
    content: input.content,
    created_at: now,
    id: crypto.randomUUID(),
    scope: input.scope,
  };

  drizzle(db).insert(memorySnapshots).values(snapshot).run();
  return snapshot;
}

export function createReflection(db: Database, input: CreateReflectionInput): MemoryReflection {
  const now = new Date().toISOString();
  const reflection = {
    consolidated_content: input.consolidatedContent,
    created_at: now,
    id: crypto.randomUUID(),
    source_snapshot_ids: JSON.stringify(input.sourceSnapshotIds),
  };

  drizzle(db).insert(memoryReflections).values(reflection).run();
  return reflection;
}

export function listSnapshots(db: Database, limit = 20): MemorySnapshot[] {
  return drizzle(db)
    .select()
    .from(memorySnapshots)
    .orderBy(desc(memorySnapshots.created_at))
    .limit(limit)
    .all() as MemorySnapshot[];
}

export function listReflections(db: Database, limit = 20): MemoryReflection[] {
  return drizzle(db)
    .select()
    .from(memoryReflections)
    .orderBy(desc(memoryReflections.created_at))
    .limit(limit)
    .all();
}

export function countSnapshots(db: Database): number {
  const row = drizzle(db)
    .select({ count: sql<number>`count(*)` })
    .from(memorySnapshots)
    .get();
  return Number(row?.count ?? 0);
}

export function countReflections(db: Database): number {
  const row = drizzle(db)
    .select({ count: sql<number>`count(*)` })
    .from(memoryReflections)
    .get();
  return Number(row?.count ?? 0);
}

export function parseSourceSnapshotIds(reflection: MemoryReflection): string[] {
  const parsed = JSON.parse(reflection.source_snapshot_ids) as unknown;
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}
