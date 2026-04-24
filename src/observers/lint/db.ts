import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';

export type LintStatus = 'proposed' | 'accepted' | 'rejected' | 'deferred' | 'implemented';

export interface LintEntry {
  id: string;
  status: LintStatus;
  description: string;
  proposed_form: string | null;
  source_excerpt: string | null;
  detector_version: string;
  created_at: string;
  updated_at: string;
}

export interface LintRecurrence {
  id: number;
  entry_id: string;
  note: string;
  observed_at: string;
}

export function listEntries(db: Database, status?: LintStatus): LintEntry[] {
  let query = 'SELECT * FROM lint_entries';
  const params: any[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  return db.prepare(query).all(...params) as LintEntry[];
}

export function getEntry(db: Database, id: string): LintEntry | null {
  return db.prepare('SELECT * FROM lint_entries WHERE id = ?').get(id) as LintEntry | null;
}

export function createEntry(
  db: Database,
  data: Omit<LintEntry, 'id' | 'created_at' | 'updated_at'>,
): LintEntry {
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO lint_entries (id, status, description, proposed_form, source_excerpt, detector_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    data.status,
    data.description,
    data.proposed_form,
    data.source_excerpt,
    data.detector_version,
    now,
    now,
  );

  return getEntry(db, id)!;
}

export function updateEntryStatus(db: Database, id: string, status: LintStatus): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE lint_entries SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    now,
    id,
  );
}

export function addRecurrence(db: Database, entryId: string, note: string): void {
  db.prepare(
    `
    INSERT INTO lint_recurrences (entry_id, note, observed_at)
    VALUES (?, ?, ?)
  `,
  ).run(entryId, note, new Date().toISOString());

  // Also bump the updated_at on the entry
  db.prepare('UPDATE lint_entries SET updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    entryId,
  );
}

export function getRecurrences(db: Database, entryId: string): LintRecurrence[] {
  return db
    .prepare('SELECT * FROM lint_recurrences WHERE entry_id = ? ORDER BY observed_at DESC')
    .all(entryId) as LintRecurrence[];
}
