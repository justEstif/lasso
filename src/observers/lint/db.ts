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

export function addRecurrence(db: LassoDb, entryId: string, input: AddRecurrenceInput): void {
  const now = new Date().toISOString();

  db.insert(lintRecurrences)
    .values({
      entry_id: entryId,
      note: input.note,
      observed_at: now,
      referenced_date: input.referencedDate ?? null,
      relative_offset: input.relativeOffset ?? null,
    })
    .run();
  db.update(lintEntries).set({ updated_at: now }).where(eq(lintEntries.id, entryId)).run();
}

export function createEntry(
  db: LassoDb,
  data: Omit<LintEntry, 'created_at' | 'id' | 'updated_at'>,
): LintEntry {
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry = { ...data, created_at: now, id, updated_at: now };

  db.insert(lintEntries).values(entry).run();
  return getEntry(db, id)!;
}

export function getEntry(db: LassoDb, id: string): LintEntry | null {
  const prepared = db
    .select()
    .from(lintEntries)
    .where(eq(lintEntries.id, sql.placeholder('id')))
    .prepare();

  return (prepared.get({ id }) as LintEntry | undefined) ?? null;
}

export function resolveEntryId(db: LassoDb, idOrPrefix: string): string {
  const exact = getEntry(db, idOrPrefix);
  if (exact) return exact.id;

  const matches = db
    .select({ id: lintEntries.id })
    .from(lintEntries)
    .where(sql`${lintEntries.id} LIKE ${`${idOrPrefix}%`}`)
    .limit(2)
    .all();

  if (matches.length === 1 && matches[0]?.id) return matches[0].id;
  if (matches.length > 1) throw new Error(`Lint entry id prefix ${idOrPrefix} is ambiguous.`);
  throw new Error(`Lint entry ${idOrPrefix} not found.`);
}

export function getLastScanRun(db: LassoDb): LintScanRun | null {
  const prepared = db
    .select()
    .from(lintScanRuns)
    .orderBy(desc(lintScanRuns.scanned_at))
    .limit(1)
    .prepare();

  return (prepared.get() as LintScanRun | undefined) ?? null;
}

export function getLintObservationState(db: LassoDb): LintObservationState {
  const row = db.select().from(lintObservationState).limit(1).get();
  return {
    lastObservedTokens: row?.last_observed_tokens ?? 0,
    lastObservedTurns: row?.last_observed_turns ?? 0,
  };
}

export function getRecurrences(db: LassoDb, entryId: string): LintRecurrence[] {
  const prepared = db
    .select()
    .from(lintRecurrences)
    .where(eq(lintRecurrences.entry_id, sql.placeholder('entryId')))
    .orderBy(desc(lintRecurrences.observed_at))
    .prepare();

  return prepared.all({ entryId }) as LintRecurrence[];
}

export function listActiveEntries(db: LassoDb, limit: number): LintEntry[] {
  const prepared = db
    .select()
    .from(lintEntries)
    .where(inArray(lintEntries.status, ['proposed', 'accepted', 'deferred']))
    .orderBy(desc(lintEntries.updated_at))
    .limit(sql.placeholder('limit'))
    .prepare();

  return prepared.all({ limit }) as LintEntry[];
}

export function listEntries(db: LassoDb, status?: LintStatus): LintEntry[] {
  if (status) return listEntriesByStatus(db, status);

  const prepared = db.select().from(lintEntries).orderBy(desc(lintEntries.created_at)).prepare();

  return prepared.all() as LintEntry[];
}

export function recordLintObservationProgress(
  db: LassoDb,
  progress: { observedTokens: number; observedTurns: number },
): void {
  const now = new Date().toISOString();
  const existing = db.select().from(lintObservationState).limit(1).get();

  if (existing) {
    db.update(lintObservationState)
      .set({
        last_observed_tokens: progress.observedTokens,
        last_observed_turns: progress.observedTurns,
        updated_at: now,
      })
      .where(eq(lintObservationState.id, existing.id))
      .run();
    return;
  }

  db.insert(lintObservationState)
    .values({
      last_observed_tokens: progress.observedTokens,
      last_observed_turns: progress.observedTurns,
      updated_at: now,
    })
    .run();
}

export function recordScanRun(
  db: LassoDb,
  summary: { created: number; recurrences: number; skipped: number },
): void {
  db.insert(lintScanRuns)
    .values({
      created_count: summary.created,
      recurrence_count: summary.recurrences,
      scanned_at: new Date().toISOString(),
      skipped_count: summary.skipped,
    })
    .run();
}

export function updateEntryStatus(db: LassoDb, id: string, status: LintStatus): void {
  db.update(lintEntries)
    .set({ status, updated_at: new Date().toISOString() })
    .where(eq(lintEntries.id, id))
    .run();
}

function listEntriesByStatus(db: LassoDb, status: LintStatus): LintEntry[] {
  const prepared = db
    .select()
    .from(lintEntries)
    .where(eq(lintEntries.status, sql.placeholder('status')))
    .orderBy(desc(lintEntries.created_at))
    .prepare();

  return prepared.all({ status }) as LintEntry[];
}
