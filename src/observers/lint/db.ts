import { desc, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { LassoDb } from '../../db/index.ts';

import {
  lintEntries,
  lintObservationState,
  lintRecurrences,
  lintScanRuns,
} from '../../db/schema.ts';

export interface AddRecurrenceInput {
  note: string;
  referencedDate?: null | string;
  relativeOffset?: null | number;
}

export interface LintObservationState {
  lastObservedTokens: number;
  lastObservedTurns: number;
}

export type LintStatus = 'proposed' | 'accepted' | 'rejected' | 'deferred' | 'implemented';

export type LintEntry = typeof lintEntries.$inferSelect & { status: LintStatus };
export type LintRecurrence = typeof lintRecurrences.$inferSelect;
export type LintScanRun = typeof lintScanRuns.$inferSelect;

export async function addRecurrence(
  db: LassoDb,
  entryId: string,
  input: AddRecurrenceInput,
): Promise<void> {
  const now = new Date().toISOString();

  await db.insert(lintRecurrences).values({
    entry_id: entryId,
    note: input.note,
    observed_at: now,
    referenced_date: input.referencedDate ?? null,
    relative_offset: input.relativeOffset ?? null,
  });
  await db.update(lintEntries).set({ updated_at: now }).where(eq(lintEntries.id, entryId));
}

export async function createEntry(
  db: LassoDb,
  data: Omit<LintEntry, 'created_at' | 'id' | 'updated_at'>,
): Promise<LintEntry> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry = { ...data, created_at: now, id, updated_at: now };

  await db.insert(lintEntries).values(entry);
  return (await getEntry(db, id))!;
}

export async function getEntry(db: LassoDb, id: string): Promise<LintEntry | null> {
  const rows = await db.select().from(lintEntries).where(eq(lintEntries.id, id)).limit(1);
  const entry = rows[0] as LintEntry | undefined;
  return entry ? normalizeLintEntry(entry) : null;
}

export async function resolveEntryId(db: LassoDb, idOrPrefix: string): Promise<string> {
  const exact = await getEntry(db, idOrPrefix);
  if (exact) return exact.id;

  const matches = await db
    .select({ id: lintEntries.id })
    .from(lintEntries)
    .where(sql`${lintEntries.id} LIKE ${`${idOrPrefix}%`}`)
    .limit(2);

  if (matches.length === 1 && matches[0]?.id) return matches[0].id;
  if (matches.length > 1) throw new Error(`Lint entry id prefix ${idOrPrefix} is ambiguous.`);
  throw new Error(`Lint entry ${idOrPrefix} not found.`);
}

export async function getLastScanRun(db: LassoDb): Promise<LintScanRun | null> {
  const rows = await db.select().from(lintScanRuns).orderBy(desc(lintScanRuns.scanned_at)).limit(1);
  return (rows[0] as LintScanRun | undefined) ?? null;
}

export async function getLintObservationState(db: LassoDb): Promise<LintObservationState> {
  const rows = await db.select().from(lintObservationState).limit(1);
  const row = rows[0];
  return {
    lastObservedTokens: row?.last_observed_tokens ?? 0,
    lastObservedTurns: row?.last_observed_turns ?? 0,
  };
}

export async function getRecurrences(db: LassoDb, entryId: string): Promise<LintRecurrence[]> {
  return (
    (await db
      .select()
      .from(lintRecurrences)
      .where(eq(lintRecurrences.entry_id, entryId))
      .orderBy(desc(lintRecurrences.observed_at))) as LintRecurrence[]
  ).map(normalizeLintRecurrence);
}

export async function listActiveEntries(db: LassoDb, limit: number): Promise<LintEntry[]> {
  return (
    (await db
      .select()
      .from(lintEntries)
      .where(inArray(lintEntries.status, ['proposed', 'accepted', 'deferred']))
      .orderBy(desc(lintEntries.updated_at))
      .limit(limit)) as LintEntry[]
  ).map(normalizeLintEntry);
}

export async function listEntries(db: LassoDb, status?: LintStatus): Promise<LintEntry[]> {
  if (status) return listEntriesByStatus(db, status);

  return (
    (await db.select().from(lintEntries).orderBy(desc(lintEntries.created_at))) as LintEntry[]
  ).map(normalizeLintEntry);
}

export async function recordLintObservationProgress(
  db: LassoDb,
  progress: { observedTokens: number; observedTurns: number },
): Promise<void> {
  const now = new Date().toISOString();
  const existing = (await db.select().from(lintObservationState).limit(1))[0];

  if (existing) {
    await db
      .update(lintObservationState)
      .set({
        last_observed_tokens: progress.observedTokens,
        last_observed_turns: progress.observedTurns,
        updated_at: now,
      })
      .where(eq(lintObservationState.id, existing.id));
    return;
  }

  await db.insert(lintObservationState).values({
    last_observed_tokens: progress.observedTokens,
    last_observed_turns: progress.observedTurns,
    updated_at: now,
  });
}

export async function recordScanRun(
  db: LassoDb,
  summary: { created: number; recurrences: number; skipped: number },
): Promise<void> {
  await db.insert(lintScanRuns).values({
    created_count: summary.created,
    recurrence_count: summary.recurrences,
    scanned_at: new Date().toISOString(),
    skipped_count: summary.skipped,
  });
}

export async function updateEntryStatus(
  db: LassoDb,
  id: string,
  status: LintStatus,
): Promise<void> {
  await db
    .update(lintEntries)
    .set({ status, updated_at: new Date().toISOString() })
    .where(eq(lintEntries.id, id));
}

function normalizeDateOnly(value: null | string): null | string {
  return value?.endsWith(' 00:00:00+00') ? value.slice(0, 10) : value;
}

function normalizeLintEntry(entry: LintEntry): LintEntry {
  return { ...entry, referenced_date: normalizeDateOnly(entry.referenced_date) };
}

function normalizeLintRecurrence(recurrence: LintRecurrence): LintRecurrence {
  return { ...recurrence, referenced_date: normalizeDateOnly(recurrence.referenced_date) };
}

async function listEntriesByStatus(db: LassoDb, status: LintStatus): Promise<LintEntry[]> {
  return (
    (await db
      .select()
      .from(lintEntries)
      .where(eq(lintEntries.status, status))
      .orderBy(desc(lintEntries.created_at))) as LintEntry[]
  ).map(normalizeLintEntry);
}
