import { and, asc, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';

import type { LassoDb } from '../../db/index.ts';
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

export async function checkShouldReflect(
  db: LassoDb,
  scope: MemoryScope,
  threshold: number,
): Promise<ShouldReflectResult> {
  const lastObserved = await getObservationState(db, scope);
  return { lastObserved, needed: lastObserved >= threshold, threshold };
}

export async function countEntries(db: LassoDb): Promise<number> {
  const row = (await db.select({ count: sql<number>`count(*)` }).from(observationEntries))[0];
  return Number(row?.count ?? 0);
}

export async function countReflections(db: LassoDb): Promise<number> {
  const row = (await db.select({ count: sql<number>`count(*)` }).from(memoryReflections))[0];
  return Number(row?.count ?? 0);
}

export async function countSnapshots(db: LassoDb): Promise<number> {
  const row = (await db.select({ count: sql<number>`count(*)` }).from(memorySnapshots))[0];
  return Number(row?.count ?? 0);
}

export async function createEntries(
  db: LassoDb,
  input: CreateEntriesInput,
): Promise<ObservationEntry[]> {
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

  if (rows.length > 0) await db.insert(observationEntries).values(rows);
  return rows;
}

export async function createReflection(
  db: LassoDb,
  input: CreateReflectionInput,
): Promise<MemoryReflection> {
  const reflection = {
    consolidated_content: input.consolidatedContent,
    created_at: new Date().toISOString(),
    id: crypto.randomUUID(),
    source_snapshot_ids: input.sourceSnapshotIds,
  };

  await db.insert(memoryReflections).values(reflection);
  return reflection;
}

export async function createSnapshot(
  db: LassoDb,
  input: CreateSnapshotInput,
): Promise<MemorySnapshot> {
  const existing = await findDuplicateSnapshot(db, input.content);
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

  await db.insert(memorySnapshots).values(snapshot);
  return snapshot as MemorySnapshot;
}

export async function getObservationState(db: LassoDb, scope: MemoryScope): Promise<number> {
  const row = (
    await db
      .select()
      .from(memoryObservationState)
      .where(eq(memoryObservationState.scope, scope))
      .limit(1)
  )[0];
  return row?.last_observed_tokens ?? 0;
}

export async function listEntries(
  db: LassoDb,
  options: EntryFilterOptions = {},
): Promise<ObservationEntry[]> {
  const { after, before, limit = 100, priority, sortField, sortOrder } = options;
  const conditions = [];

  if (priority) conditions.push(eq(observationEntries.priority, priority));
  if (after) conditions.push(gte(observationEntries.observed_at, after));
  if (before) conditions.push(lte(observationEntries.observed_at, before));

  const column = observationEntries[sortField ?? 'observed_at'];
  const order = sortOrder === 'asc' ? asc(column) : desc(column);
  const query = db
    .select()
    .from(observationEntries)
    .orderBy(order, desc(observationEntries.created_at));

  if (conditions.length > 0) query.where(and(...conditions));
  return (await query.limit(limit)).map(normalizeObservationEntry);
}

export async function listEntriesBySnapshot(
  db: LassoDb,
  snapshotId: string,
): Promise<ObservationEntry[]> {
  return (
    await db
      .select()
      .from(observationEntries)
      .where(eq(observationEntries.snapshot_id, snapshotId))
      .orderBy(desc(observationEntries.observed_at))
  ).map(normalizeObservationEntry);
}

export async function listReflections(db: LassoDb, limit = 20): Promise<MemoryReflection[]> {
  return await db
    .select()
    .from(memoryReflections)
    .orderBy(desc(memoryReflections.created_at))
    .limit(limit);
}

export async function listSnapshots(db: LassoDb, limit = 20): Promise<MemorySnapshot[]> {
  return (await db
    .select()
    .from(memorySnapshots)
    .where(isNull(memorySnapshots.superseded_by))
    .orderBy(desc(memorySnapshots.last_seen_at), desc(memorySnapshots.created_at))
    .limit(limit)) as MemorySnapshot[];
}

export function parseSourceSnapshotIds(reflection: MemoryReflection): string[] {
  return Array.isArray(reflection.source_snapshot_ids)
    ? reflection.source_snapshot_ids.filter((id): id is string => typeof id === 'string')
    : [];
}

export async function recordObservationTokenCount(
  db: LassoDb,
  scope: MemoryScope,
  tokens: number,
): Promise<void> {
  const existing = (
    await db
      .select()
      .from(memoryObservationState)
      .where(eq(memoryObservationState.scope, scope))
      .limit(1)
  )[0];
  const now = new Date().toISOString();

  if (existing) {
    await db
      .update(memoryObservationState)
      .set({ last_observed_tokens: tokens, updated_at: now })
      .where(eq(memoryObservationState.scope, scope));
  } else {
    await db
      .insert(memoryObservationState)
      .values({ last_observed_tokens: tokens, scope, updated_at: now });
  }
}

export async function searchEntries(
  db: LassoDb,
  query: string,
  options: EntryFilterOptions = {},
): Promise<ObservationEntry[]> {
  const queryTokens = new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g));
  const entries = await listEntries(db, { ...options, limit: 200 });

  return entries
    .map((entry) => ({ entry, score: scoreContent(entry.content, queryTokens) }))
    .filter((result) => result.score > 0)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, options.limit ?? 10)
    .map((result) => result.entry);
}

export async function searchSnapshots(
  db: LassoDb,
  query: string,
  limit = 5,
): Promise<MemorySnapshot[]> {
  const queryTokens = new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g));
  return (await listSnapshots(db, 100))
    .map((snapshot) => ({ score: scoreSnapshot(snapshot.content, queryTokens), snapshot }))
    .filter((result) => result.score > 0)
    .toSorted((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => result.snapshot);
}

async function findDuplicateSnapshot(db: LassoDb, content: string): Promise<MemorySnapshot | null> {
  const hash = normalizedMemoryHash(content);
  const exact = (
    await db
      .select()
      .from(memorySnapshots)
      .where(eq(memorySnapshots.normalized_hash, hash))
      .limit(1)
  )[0] as MemorySnapshot | undefined;
  if (exact) return exact;

  const fingerprint = memoryFingerprint(content);
  return (
    (await listSnapshots(db, 100)).find((snapshot) => {
      if (tokenSimilarity(content, snapshot.content) >= 0.6) return true;
      return snapshot.fingerprint
        ? hammingDistance(fingerprint, snapshot.fingerprint) <= 12
        : false;
    }) ?? null
  );
}

async function recordSnapshotSeen(db: LassoDb, id: string): Promise<MemorySnapshot> {
  const existing = (
    await db.select().from(memorySnapshots).where(eq(memorySnapshots.id, id)).limit(1)
  )[0] as MemorySnapshot;
  const now = new Date().toISOString();
  const seenCount = (existing.seen_count ?? 1) + 1;

  await db
    .update(memorySnapshots)
    .set({ last_seen_at: now, seen_count: seenCount })
    .where(eq(memorySnapshots.id, id));
  return { ...existing, last_seen_at: now, seen_count: seenCount } as MemorySnapshot;
}

function normalizeDateOnly(value: null | string): null | string {
  return value?.endsWith(' 00:00:00+00') ? value.slice(0, 10) : value;
}

function normalizeObservationEntry(entry: ObservationEntry): ObservationEntry {
  return {
    ...entry,
    observed_at: normalizeDateOnly(entry.observed_at) ?? entry.observed_at,
    referenced_date: normalizeDateOnly(entry.referenced_date),
  };
}

function scoreContent(content: string, queryTokens: Set<string>): number {
  const tokens = content.toLowerCase().match(/[a-z0-9][a-z0-9_.:/-]{2,}/g) ?? [];
  return tokens.filter((token) => queryTokens.has(token)).length;
}

function scoreSnapshot(content: string, queryTokens: Set<string>): number {
  return scoreContent(content, queryTokens);
}
