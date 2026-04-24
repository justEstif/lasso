import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const lintEntries = sqliteTable('lint_entries', {
  created_at: text('created_at').notNull(),
  description: text('description').notNull(),
  detector_version: text('detector_version').notNull(),
  id: text('id').primaryKey(),
  proposed_form: text('proposed_form'),
  source_excerpt: text('source_excerpt'),
  status: text('status').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const lintRecurrences = sqliteTable('lint_recurrences', {
  entry_id: text('entry_id')
    .notNull()
    .references(() => lintEntries.id),
  id: integer('id').primaryKey({ autoIncrement: true }),
  note: text('note').notNull(),
  observed_at: text('observed_at').notNull(),
});

export const lintScanRuns = sqliteTable('lint_scan_runs', {
  created_count: integer('created_count').notNull(),
  id: integer('id').primaryKey({ autoIncrement: true }),
  recurrence_count: integer('recurrence_count').notNull(),
  scanned_at: text('scanned_at').notNull(),
  skipped_count: integer('skipped_count').notNull(),
});
