import type { Database } from 'bun:sqlite';

import { desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { randomUUID } from 'node:crypto';

import {
  lintEntries,
  lintObservationState,
  lintRecurrences,
  lintScanRuns,
} from '../../db/schema.ts';

export type LintStatus = 'proposed' | 'accepted' | 'rejected' | 'deferred' | 'implemented';

export type LintEntry = typeof lintEntries.$inferSelect & { status: LintStatus };
export type LintRecurrence = typeof lintRecurrences.$inferSelect;
export type LintScanRun = typeof lintScanRuns.$inferSelect;

export function addRecurrence(db: Database, entryId: string, note: string): void {
  const orm = drizzle(db);
  const now = new Date().toISOString();

  orm.insert(lintRecurrences).values({ entry_id: entryId, note, observed_at: now }).run();
  orm.update(lintEntries).set({ updated_at: now }).where(eq(lintEntries.id, entryId)).run();
}

export function createEntry(
  db: Database,
  data: Omit<LintEntry, 'created_at' | 'id' | 'updated_at'>,
): LintEntry {
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry = { ...data, created_at: now, id, updated_at: now };

  drizzle(db).insert(lintEntries).values(entry).run();
  return getEntry(db, id)!;
}

export function getEntry(db: Database, id: string): LintEntry | null {
  const prepared = drizzle(db)
    .select()
    .from(lintEntries)
    .where(eq(lintEntries.id, sql.placeholder('id')))
    .prepare();

  return (prepared.get({ id }) as LintEntry | undefined) ?? null;
}

export function resolveEntryId(db: Database, idOrPrefix: string): string {
  const exact = getEntry(db, idOrPrefix);
  if (exact) return exact.id;

  const matches = drizzle(db)
    .select({ id: lintEntries.id })
    .from(lintEntries)
    .where(sql`${lintEntries.id} LIKE ${`${idOrPrefix}%`}`)
    .limit(2)
    .all();

  if (matches.length === 1 && matches[0]?.id) return matches[0].id;
  if (matches.length > 1) throw new Error(`Lint entry id prefix ${idOrPrefix} is ambiguous.`);
  throw new Error(`Lint entry ${idOrPrefix} not found.`);
}

export function getLastScanRun(db: Database): LintScanRun | null {
  const prepared = drizzle(db)
    .select()
    .from(lintScanRuns)
    .orderBy(desc(lintScanRuns.scanned_at))
    .limit(1)
    .prepare();

  return (prepared.get() as LintScanRun | undefined) ?? null;
}

export function getLintObservationState(db: Database): number {
  const row = drizzle(db).select().from(lintObservationState).limit(1).get();
  return row?.last_observed_tokens ?? 0;
}

export function getRecurrences(db: Database, entryId: string): LintRecurrence[] {
  const prepared = drizzle(db)
    .select()
    .from(lintRecurrences)
    .where(eq(lintRecurrences.entry_id, sql.placeholder('entryId')))
    .orderBy(desc(lintRecurrences.observed_at))
    .prepare();

  return prepared.all({ entryId }) as LintRecurrence[];
}

export function listActiveEntries(db: Database, limit: number): LintEntry[] {
  const prepared = drizzle(db)
    .select()
    .from(lintEntries)
    .where(inArray(lintEntries.status, ['proposed', 'accepted', 'deferred']))
    .orderBy(desc(lintEntries.updated_at))
    .limit(sql.placeholder('limit'))
    .prepare();

  return prepared.all({ limit }) as LintEntry[];
}

export function listEntries(db: Database, status?: LintStatus): LintEntry[] {
  if (status) return listEntriesByStatus(db, status);

  const prepared = drizzle(db)
    .select()
    .from(lintEntries)
    .orderBy(desc(lintEntries.created_at))
    .prepare();

  return prepared.all() as LintEntry[];
}

export function recordLintObservationTokenCount(db: Database, observedTokens: number): void {
  const orm = drizzle(db);
  const now = new Date().toISOString();
  const existing = orm.select().from(lintObservationState).limit(1).get();

  if (existing) {
    orm
      .update(lintObservationState)
      .set({ last_observed_tokens: observedTokens, updated_at: now })
      .where(eq(lintObservationState.id, existing.id))
      .run();
    return;
  }

  orm
    .insert(lintObservationState)
    .values({ last_observed_tokens: observedTokens, updated_at: now })
    .run();
}

export function recordScanRun(
  db: Database,
  summary: { created: number; recurrences: number; skipped: number },
): void {
  drizzle(db)
    .insert(lintScanRuns)
    .values({
      created_count: summary.created,
      recurrence_count: summary.recurrences,
      scanned_at: new Date().toISOString(),
      skipped_count: summary.skipped,
    })
    .run();
}

export function updateEntryStatus(db: Database, id: string, status: LintStatus): void {
  drizzle(db)
    .update(lintEntries)
    .set({ status, updated_at: new Date().toISOString() })
    .where(eq(lintEntries.id, id))
    .run();
}

function listEntriesByStatus(db: Database, status: LintStatus): LintEntry[] {
  const prepared = drizzle(db)
    .select()
    .from(lintEntries)
    .where(eq(lintEntries.status, sql.placeholder('status')))
    .orderBy(desc(lintEntries.created_at))
    .prepare();

  return prepared.all({ status }) as LintEntry[];
}
