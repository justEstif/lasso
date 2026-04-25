import { Database } from 'bun:sqlite';
import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import type { ObservationPriority, ParsedEntry } from './parser.ts';

import {
  memoryObservationState,
  memoryReflections,
  memorySnapshots,
  observationEntries,
} from '../../db/schema.ts';
import {
  hammingDistance,
  memoryFingerprint,
  normalizedMemoryHash,
  tokenSimilarity,
} from './fingerprint.ts';

export interface CreateEntriesInput {
  entries: ParsedEntry[];
  snapshotId: string;
}
export interface CreateReflectionInput {
  consolidatedContent: string;
  sourceSnapshotIds: string[];
}
export interface CreateSnapshotInput {
  content: string;
  scope: MemoryScope;
}

export interface EntryFilterOptions {
  after?: string;
  before?: string;
  limit?: number;
  priority?: ObservationPriority;
  sortField?: EntrySortField;
  sortOrder?: 'asc' | 'desc';
}

export type EntrySortField = 'created_at' | 'observed_at' | 'referenced_date';

export type MemoryReflection = typeof memoryReflections.$inferSelect;

export type MemoryScope = 'resource' | 'thread';

export type MemorySnapshot = typeof memorySnapshots.$inferSelect & { scope: MemoryScope };

export type ObservationEntry = typeof observationEntries.$inferSelect;

export interface ShouldReflectResult {
  lastObserved: number;
  needed: boolean;
  threshold: number;
}

export function checkShouldReflect(
  db: Database,
  scope: MemoryScope,
  threshold: number,
): ShouldReflectResult {
  const lastObserved = getObservationState(db, scope);
  return { lastObserved, needed: lastObserved >= threshold, threshold };
}

export function countEntries(db: Database): number {
  const row = drizzle(db)
    .select({ count: sql<number>`count(*)` })
    .from(observationEntries)
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

export function countSnapshots(db: Database): number {
  const row = drizzle(db)
    .select({ count: sql<number>`count(*)` })
    .from(memorySnapshots)
    .get();
  return Number(row?.count ?? 0);
}

export function createEntries(db: Database, input: CreateEntriesInput): ObservationEntry[] {
  const now = new Date().toISOString();
  const rows = input.entries.map((entry) => ({
    category: entry.category,
    content: entry.content,
    created_at: now,
    id: crypto.randomUUID(),
    observed_at: entry.observedAt,
    priority: entry.priority,
    referenced_date: entry.referencedDate ?? null,
    relative_offset: entry.relativeOffset ?? null,
    snapshot_id: input.snapshotId,
  }));

  for (const row of rows) {
    drizzle(db).insert(observationEntries).values(row).run();
  }

  return rows;
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

export function getObservationState(db: Database, scope: MemoryScope): number {
  const row = drizzle(db)
    .select()
    .from(memoryObservationState)
    .where(eq(memoryObservationState.scope, scope))
    .get();
  return row?.last_observed_tokens ?? 0;
}

export function listEntries(db: Database, options: EntryFilterOptions = {}): ObservationEntry[] {
  const { after, before, limit = 100, priority, sortField, sortOrder } = options;
  const conditions = [];

  if (priority) conditions.push(eq(observationEntries.priority, priority));
  if (after) conditions.push(gte(observationEntries.observed_at, after));
  if (before) conditions.push(lte(observationEntries.observed_at, before));

  const column = observationEntries[sortField ?? 'observed_at'];
  const order = sortOrder === 'asc' ? asc(column) : desc(column);

  const query = drizzle(db)
    .select()
    .from(observationEntries)
    .orderBy(order, desc(observationEntries.created_at));

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  return query.limit(limit).all();
}

export function listEntriesBySnapshot(db: Database, snapshotId: string): ObservationEntry[] {
  return drizzle(db)
    .select()
    .from(observationEntries)
    .where(eq(observationEntries.snapshot_id, snapshotId))
    .orderBy(desc(observationEntries.observed_at))
    .all();
}

export function listReflections(db: Database, limit = 20): MemoryReflection[] {
  return drizzle(db)
    .select()
    .from(memoryReflections)
    .orderBy(desc(memoryReflections.created_at))
    .limit(limit)
    .all();
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

export function parseSourceSnapshotIds(reflection: MemoryReflection): string[] {
  const parsed = JSON.parse(reflection.source_snapshot_ids) as unknown;
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

export function recordObservationTokenCount(
  db: Database,
  scope: MemoryScope,
  tokens: number,
): void {
  const existing = drizzle(db)
    .select()
    .from(memoryObservationState)
    .where(eq(memoryObservationState.scope, scope))
    .get();

  const now = new Date().toISOString();

  if (existing) {
    drizzle(db)
      .update(memoryObservationState)
      .set({ last_observed_tokens: tokens, updated_at: now })
      .where(eq(memoryObservationState.scope, scope))
      .run();
  } else {
    drizzle(db)
      .insert(memoryObservationState)
      .values({ last_observed_tokens: tokens, scope, updated_at: now })
      .run();
  }
}

export function searchEntries(
  db: Database,
  query: string,
  options: EntryFilterOptions = {},
): ObservationEntry[] {
  const queryTokens = new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g));
  const entries = listEntries(db, { ...options, limit: 200 });

  return entries
    .map((entry) => ({ entry, score: scoreContent(entry.content, queryTokens) }))
    .filter((result) => result.score > 0)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, options.limit ?? 10)
    .map((result) => result.entry);
}

export function searchSnapshots(db: Database, query: string, limit = 5): MemorySnapshot[] {
  const queryTokens = new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g));
  return listSnapshots(db, 100)
    .map((snapshot) => ({ score: scoreSnapshot(snapshot.content, queryTokens), snapshot }))
    .filter((result) => result.score > 0)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.snapshot);
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

function scoreContent(content: string, queryTokens: Set<string>): number {
  const tokens = content.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g) ?? [];
  return tokens.filter((token) => queryTokens.has(token)).length;
}

function scoreSnapshot(content: string, queryTokens: Set<string>): number {
  return scoreContent(content, queryTokens);
}
