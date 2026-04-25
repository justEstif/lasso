import { Database } from 'bun:sqlite';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import { memoryReflections, memorySnapshots } from '../../db/schema.ts';
import {
  hammingDistance,
  memoryFingerprint,
  normalizedMemoryHash,
  tokenSimilarity,
} from './fingerprint.ts';

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
  const existing = findDuplicateSnapshot(db, input.content);
  if (existing) return recordSnapshotSeen(db, existing.id);

  const now = new Date().toISOString();
  const snapshot = {
    content: input.content,
    created_at: now,
    fingerprint: memoryFingerprint(input.content),
    id: crypto.randomUUID(),
    last_seen_at: now,
    normalized_hash: normalizedMemoryHash(input.content),
    scope: input.scope,
    seen_count: 1,
    superseded_by: null,
  };

  drizzle(db).insert(memorySnapshots).values(snapshot).run();
  return snapshot as MemorySnapshot;
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
    .where(isNull(memorySnapshots.superseded_by))
    .orderBy(desc(memorySnapshots.last_seen_at), desc(memorySnapshots.created_at))
    .limit(limit)
    .all() as MemorySnapshot[];
}

export function searchSnapshots(db: Database, query: string, limit = 5): MemorySnapshot[] {
  const queryTokens = new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g) ?? []);
  return listSnapshots(db, 100)
    .map((snapshot) => ({ score: scoreSnapshot(snapshot.content, queryTokens), snapshot }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.snapshot);
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

function findDuplicateSnapshot(db: Database, content: string): MemorySnapshot | null {
  const hash = normalizedMemoryHash(content);
  const exact = drizzle(db)
    .select()
    .from(memorySnapshots)
    .where(eq(memorySnapshots.normalized_hash, hash))
    .get() as MemorySnapshot | undefined;
  if (exact) return exact;

  const fingerprint = memoryFingerprint(content);
  return (
    listSnapshots(db, 100).find((snapshot) => {
      if (tokenSimilarity(content, snapshot.content) >= 0.6) return true;
      return snapshot.fingerprint
        ? hammingDistance(fingerprint, snapshot.fingerprint) <= 12
        : false;
    }) ?? null
  );
}

function recordSnapshotSeen(db: Database, id: string): MemorySnapshot {
  const existing = drizzle(db)
    .select()
    .from(memorySnapshots)
    .where(eq(memorySnapshots.id, id))
    .get() as MemorySnapshot;
  const now = new Date().toISOString();

  drizzle(db)
    .update(memorySnapshots)
    .set({ last_seen_at: now, seen_count: (existing.seen_count ?? 1) + 1 })
    .where(eq(memorySnapshots.id, id))
    .run();

  return {
    ...existing,
    last_seen_at: now,
    seen_count: (existing.seen_count ?? 1) + 1,
  } as MemorySnapshot;
}

function scoreSnapshot(content: string, queryTokens: Set<string>): number {
  const contentTokens = content.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g) ?? [];
  return contentTokens.filter((token) => queryTokens.has(token)).length;
}
