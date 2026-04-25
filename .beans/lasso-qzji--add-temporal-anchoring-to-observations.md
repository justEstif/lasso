---
# lasso-qzji
title: Add temporal anchoring to observations
status: completed
type: feature
priority: normal
created_at: 2026-04-25T15:19:31Z
updated_at: 2026-04-25T20:35:34Z
parent: lasso-93aq
---

Add three-date temporal model to observation entries, stored in DB.

Mastra tracks up to three dates per observation:
- Observation date: when the observation was created
- Referenced date: the date mentioned in content itself ("my flight is January 31")
- Relative date: computed offset ("2 days from today")

Implementation:
- Add columns to observation entries: observed_at, referenced_date, relative_offset
- Observer prompt extracts date references from conversation content
- CLI can filter/sort by any date dimension
- Critical for temporal reasoning (Mastra scores 95.5% on temporal tasks with this)

This pairs with the enriched observation format bean (lasso-f1w3).

- [x] Add referenced_date and relative_offset columns to observation_entries schema
- [x] Generate Drizzle migration
- [x] Update parser to extract temporal anchors from structured entries
- [x] Update DB functions for temporal columns
- [x] Update CLI commands with temporal filter/sort flags
- [x] Update observer prompt to request temporal annotations
- [x] Write tests for temporal parsing and DB operations
- [x] Lint and type-check touched files
- [x] Run full test suite

## Summary of Changes

- **Schema**: Added `referenced_date` (text, nullable) and `relative_offset` (integer, nullable) columns to `observation_entries` table
- **Migration**: Generated `drizzle/0002_mixed_stranger.sql` with ALTER TABLE statements
- **Parser**: Extended `ParsedEntry` interface with `referencedDate` and `relativeOffset` fields; added `extractTemporal()` function that parses `[ref:YYYY-MM-DD]` and `[rel:+/-Nd]` inline tags from observation text, stripping them from content
- **DB**: Updated `createEntries()` to persist temporal columns; added `sortField`/`sortOrder` to `EntryFilterOptions`; `listEntries()` now supports sorting by `observed_at`, `created_at`, or `referenced_date` in asc/desc order
- **CLI**: Added `--sort <field:order>` flag to `memory context` command; `formatTemporalAnchor()` renders temporal info in context/export output
- **Observer prompt**: Updated Pi extension template to instruct the LLM to include `[ref:YYYY-MM-DD]` and `[rel:+/-Nd]` temporal annotations in observations
- **Tests**: 8 new tests covering temporal parsing (ref date, +/- offsets, both, none), DB storage, and sorting by referenced_date and created_at. All 55 tests pass, lint clean, types clean.
