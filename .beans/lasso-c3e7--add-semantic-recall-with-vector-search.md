---
# lasso-c3e7
title: Replace JS token search with SQLite FTS5
status: completed
type: feature
priority: normal
created_at: 2026-04-25T15:20:15Z
updated_at: 2026-04-26T13:18:04Z
parent: lasso-93aq
---

The current searchEntries pulls up to 200 rows into JS and does manual token matching — not even using SQLite FTS. Replace with proper FTS5 full-text search with BM25 ranking. Zero new deps, built into bun:sqlite.

## Implementation

- [x] Add FTS5 virtual table over observation_entries (content + category)
- [x] Add FTS5 virtual table over memory_snapshots (content)
- [x] Auto-sync via triggers on insert/update/delete
- [x] Create Drizzle migration for FTS5 tables + triggers
- [x] Add ensureFtsIndexes() for in-memory test DBs
- [x] Replace searchEntries JS token loop with FTS5 MATCH + BM25 ranking
- [x] Replace searchSnapshots JS token loop with FTS5 MATCH + BM25 ranking
- [x] Remove scoreContent() and scoreSnapshot() helper functions
- [x] Update all affected tests
- [x] Run bun test to confirm everything passes

- Add FTS5 virtual table over observation_entries (content + category)
- Auto-sync via triggers on insert/update/delete
- Replace searchEntries JS token loop with FTS5 MATCH + BM25 ranking
- Add recall command: lasso memory recall --query <text>
- Zero new dependencies — FTS5 is built into bun:sqlite



## Summary of Changes

Replaced JS token-matching search with SQLite FTS5 full-text search + BM25 ranking.

### Files changed:
- `drizzle/0007_add_fts5_search_indexes.sql` — new migration: FTS5 virtual tables + sync triggers for observation_entries and memory_snapshots
- `drizzle/meta/_journal.json` — registered the new migration
- `src/db/index.ts` — added `ensureFtsIndexes()` helper for in-memory test DBs
- `src/observers/memory/db.ts` — rewrote `searchEntries()` and `searchSnapshots()` to use FTS5 MATCH + BM25 ranking; removed `scoreContent()` and `scoreSnapshot()`
- `tests/memory-db.test.ts` — added `ensureFtsIndexes(db)` call in test setup
- `tests/entries-db.test.ts` — added `ensureFtsIndexes(db)` call in test setup

### What changed:
- Search now uses SQLite FTS5 virtual tables with automatic sync triggers (insert/update/delete)
- BM25 ranking replaces intersection-count scoring — better relevance ordering
- Full corpus search replaces the 200-row hard cap
- FTS5 finds partial/stemmed matches the old JS token matcher couldn't
- Zero new dependencies — FTS5 is built into bun:sqlite
- All 75 tests pass, TypeScript clean, lint clean
