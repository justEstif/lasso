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

export const observationEntries = sqliteTable('observation_entries', {
  category: text('category').notNull(),
  content: text('content').notNull(),
  created_at: text('created_at').notNull(),
  id: text('id').primaryKey(),
  observed_at: text('observed_at').notNull(),
  priority: text('priority', {
    enum: ['high', 'low', 'medium'],
  }).notNull(),
  referenced_date: text('referenced_date'),
  relative_offset: integer('relative_offset'),
  snapshot_id: text('snapshot_id')
    .notNull()
    .references(() => memorySnapshots.id),
});

export const memorySnapshots = sqliteTable('memory_snapshots', {
  content: text('content').notNull(),
  created_at: text('created_at').notNull(),
  fingerprint: text('fingerprint'),
  id: text('id').primaryKey(),
  last_seen_at: text('last_seen_at'),
  normalized_hash: text('normalized_hash'),
  scope: text('scope').notNull(),
  seen_count: integer('seen_count').notNull().default(1),
  superseded_by: text('superseded_by'),
});

export const memoryReflections = sqliteTable('memory_reflections', {
  consolidated_content: text('consolidated_content').notNull(),
  created_at: text('created_at').notNull(),
  id: text('id').primaryKey(),
  source_snapshot_ids: text('source_snapshot_ids').notNull(),
});

export const memoryObservationState = sqliteTable('memory_observation_state', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  last_observed_tokens: integer('last_observed_tokens').notNull().default(0),
  scope: text('scope').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const workingMemory = sqliteTable('working_memory', {
  content: text('content').notNull(),
  id: text('id').primaryKey(),
  resource_id: text('resource_id'),
  thread_id: text('thread_id'),
  updated_at: text('updated_at').notNull(),
});
