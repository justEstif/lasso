import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const lintStatus = pgEnum('lint_status', [
  'proposed',
  'accepted',
  'rejected',
  'deferred',
  'implemented',
]);

export const observationPriority = pgEnum('observation_priority', ['high', 'low', 'medium']);

export const memoryScope = pgEnum('memory_scope', ['resource', 'thread']);

export const lintEntries = pgTable(
  'lint_entries',
  {
    affected_paths: jsonb('affected_paths').$type<null | string[]>(),
    category: text('category'),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
    description: text('description').notNull(),
    detector_version: text('detector_version').notNull(),
    id: text('id').primaryKey(),
    proposed_form: text('proposed_form'),
    referenced_date: timestamp('referenced_date', { mode: 'string', withTimezone: true }),
    relative_offset: integer('relative_offset'),
    severity: text('severity'),
    source_excerpt: text('source_excerpt'),
    status: lintStatus('status').notNull(),
    updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_lint_entries_active').on(table.status, table.updated_at),
    index('idx_lint_entries_status_created').on(table.status, table.created_at),
  ],
);

export const lintRecurrences = pgTable(
  'lint_recurrences',
  {
    entry_id: text('entry_id')
      .notNull()
      .references(() => lintEntries.id, { onDelete: 'cascade' }),
    id: serial('id').primaryKey(),
    note: text('note').notNull(),
    observed_at: timestamp('observed_at', { mode: 'string', withTimezone: true }).notNull(),
    referenced_date: timestamp('referenced_date', { mode: 'string', withTimezone: true }),
    relative_offset: integer('relative_offset'),
  },
  (table) => [index('idx_lint_recurrences_entry_id').on(table.entry_id, table.observed_at)],
);

export const lintScanRuns = pgTable(
  'lint_scan_runs',
  {
    created_count: integer('created_count').notNull(),
    id: serial('id').primaryKey(),
    recurrence_count: integer('recurrence_count').notNull(),
    scanned_at: timestamp('scanned_at', { mode: 'string', withTimezone: true }).notNull(),
    skipped_count: integer('skipped_count').notNull(),
  },
  (table) => [index('idx_lint_scan_runs_scanned_at').on(table.scanned_at)],
);

export const lintObservationState = pgTable('lint_observation_state', {
  id: serial('id').primaryKey(),
  last_observed_tokens: integer('last_observed_tokens').notNull().default(0),
  last_observed_turns: integer('last_observed_turns').notNull().default(0),
  updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
});

export const memorySnapshots = pgTable(
  'memory_snapshots',
  {
    content: text('content').notNull(),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
    fingerprint: text('fingerprint'),
    id: text('id').primaryKey(),
    last_seen_at: timestamp('last_seen_at', { mode: 'string', withTimezone: true }),
    normalized_hash: text('normalized_hash'),
    scope: memoryScope('scope').notNull(),
    seen_count: integer('seen_count').notNull().default(1),
    superseded_by: text('superseded_by'),
  },
  (table) => [
    index('idx_memory_snapshots_active').on(table.last_seen_at, table.created_at),
    index('idx_memory_snapshots_hash').on(table.normalized_hash),
  ],
);

export const observationEntries = pgTable(
  'observation_entries',
  {
    category: text('category').notNull(),
    content: text('content').notNull(),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
    id: text('id').primaryKey(),
    observed_at: timestamp('observed_at', { mode: 'string', withTimezone: true }).notNull(),
    priority: observationPriority('priority').notNull(),
    referenced_date: timestamp('referenced_date', { mode: 'string', withTimezone: true }),
    relative_offset: integer('relative_offset'),
    snapshot_id: text('snapshot_id')
      .notNull()
      .references(() => memorySnapshots.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('idx_observation_entries_snapshot').on(table.snapshot_id, table.observed_at),
    index('idx_observation_entries_priority').on(table.priority),
  ],
);

export const memoryReflections = pgTable(
  'memory_reflections',
  {
    consolidated_content: text('consolidated_content').notNull(),
    created_at: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
    id: text('id').primaryKey(),
    source_snapshot_ids: jsonb('source_snapshot_ids').$type<string[]>().notNull(),
  },
  (table) => [index('idx_memory_reflections_created_at').on(table.created_at)],
);

export const memoryObservationState = pgTable(
  'memory_observation_state',
  {
    id: serial('id').primaryKey(),
    last_observed_tokens: integer('last_observed_tokens').notNull().default(0),
    scope: memoryScope('scope').notNull(),
    updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
  },
  (table) => [index('idx_memory_observation_state_scope').on(table.scope)],
);

export const workingMemory = pgTable(
  'working_memory',
  {
    content: text('content').notNull(),
    id: text('id').primaryKey(),
    resource_id: text('resource_id'),
    thread_id: text('thread_id'),
    updated_at: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
  },
  (table) => [index('idx_working_memory_scope').on(table.resource_id, table.thread_id)],
);
