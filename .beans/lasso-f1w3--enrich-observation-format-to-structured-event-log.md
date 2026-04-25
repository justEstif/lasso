---
# lasso-f1w3
title: Enrich observation format to structured event log
status: completed
type: feature
priority: normal
created_at: 2026-04-25T15:19:17Z
updated_at: 2026-04-25T16:06:09Z
parent: lasso-93aq
---

Switch from a single summary blob to Mastra-style dated, prioritized event log observations stored in SQLite.

Current: observer returns a single summary string, stored as one `content` field.
Target: structured observation entries with date, priority (🔴🟡🟢), and event details.

Since we have the CLI and database, store structured observations as rows:
- Add observation_entries table (or enrich memory_snapshots schema)
- Each entry: date, priority level, content text, parent snapshot ID
- Observer prompt produces structured event log (dated bullets with emoji priorities)
- CLI can query/filter by priority and date
- Export command renders formatted event log

Benefits: denser context, better reflection input, queryable by priority/date.



## Implementation Plan
- [x] Add `observation_entries` table to schema
- [x] Generate migration with `bunx drizzle-kit generate`
- [x] Add entry CRUD functions to memory DB layer
- [x] Add structured event log parser
- [x] Update observer prompt in pi extension template
- [x] Update CLI commands (observe, export, context) with priority/date filtering
- [x] Add unit tests for parser and DB functions
- [x] Add integration tests for CLI commands
- [x] Run linter and type checker



## Summary of Changes

Added structured event log observations to replace single-blob storage:

- **Schema**: New `observation_entries` table with columns: id, snapshot_id (FK), observed_at, priority (high/medium/low), category, content, created_at
- **Migration**: Auto-generated via `bunx drizzle-kit generate` (0001_windy_mentallo.sql)
- **Parser** (`src/observers/memory/parser.ts`): Parses structured event log format with emoji (🔴🟡🟢) and bracket ([high]/[medium]/[low]) priorities; falls back to single entry for plain text
- **DB functions** (`src/observers/memory/db.ts`): Added createEntries, listEntries (with priority/date filtering), listEntriesBySnapshot, searchEntries, countEntries
- **CLI updates**: `observe` parses content into entries; `context` shows filtered entries with --priority/--after/--before flags; `export` renders categorized event log with emoji; `status` shows entry count
- **Observer prompt**: Updated pi extension template to request structured format with categories, emoji priorities, and dates
- **Tests**: 11 new tests (5 parser + 5 DB + 1 integration update), all 47 passing
