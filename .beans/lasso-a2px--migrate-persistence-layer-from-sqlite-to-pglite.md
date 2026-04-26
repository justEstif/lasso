---
# lasso-a2px
title: Migrate persistence layer from SQLite to PGlite
status: completed
type: epic
priority: low
created_at: 2026-04-25T15:17:48Z
updated_at: 2026-04-25T22:07:45Z
---

Also potentially a good time to stop and reevalute the entire schema(maybe we can use a data agent
ot review our schema)

also very important here to do a web serach becuase pglite is great, but wanna make sure its well
supported and doesn't have bugs that will break our app

Migrate lasso's database layer from bun:sqlite to PGlite (embedded Postgres via WASM). Unlocks pgvector for semantic recall, full Drizzle support, and a future path to real Postgres if needed.

Why PGlite over alternatives:
- pgvector is battle-tested (not pre-v1 like sqlite-vec)
- Official Drizzle support (drizzle-orm/pg-lite)
- Bun support confirmed
- 2.6MB gzipped, persists to filesystem
- No cloud dependency, fully local
- Same schema works with real Postgres if server mode needed later

Scope:
- Replace bun:sqlite + drizzle-orm/bun-sqlite with PGlite + drizzle-orm/pg-lite
- Migrate existing schema (memorySnapshots, memoryReflections, lintEntries, config)
- Update all DB access patterns in src/db/ and src/observers/*/db.ts
- Update CLI, tests, and Pi extension template
- Add pgvector support for semantic recall (blocked by this epic)



## Migration Checklist

- [ ] Install @electric-sql/pglite and drizzle-orm/pg-lite
- [ ] Migrate schema definitions (src/db/schema.ts)
- [ ] Migrate DB initialization and connection (src/db/index.ts)
- [ ] Migrate migrations (src/db/migrations.ts)
- [ ] Update memory observer DB layer (src/observers/memory/db.ts)
- [ ] Update lint observer DB layer (src/observers/lint/db.ts)
- [ ] Update CLI entry point (src/cli/index.ts)
- [ ] Update Pi extension template (src/onboarding/templates/pi-extension.ts.template)
- [ ] Update all tests
- [ ] Remove bun:sqlite and drizzle-orm/bun-sqlite dependencies
- [ ] Verify data migration path for existing users



## Summary of Changes

Migrated lasso persistence layer from `bun:sqlite` + `drizzle-orm/bun-sqlite` to `@electric-sql/pglite` + `drizzle-orm/pglite`.

### Architecture (Design B — abstraction layer)
- Introduced `LassoDb` type: consumers receive the Drizzle query builder, never the raw driver
- All 38 `drizzle(db)` wrapper calls collapsed to direct `db` usage
- Driver swap is a one-file change in `src/db/index.ts`

### Schema improvements
- `sqliteTable` → `pgTable` with `pgEnum` for status/severity/priority/scope
- `text` timestamps → `timestamptz` with `mode: "string"` for backward compatibility
- `source_snapshot_ids` JSON text → `jsonb` (native array storage)
- `affected_paths` JSON text → `jsonb` with typed `$type<string[]>()`
- 11 explicit indexes for actual query patterns (partial, composite, FK)
- `serial` identity columns replace SQLite auto-increment
- Single fresh migration file in PostgreSQL dialect

### Runtime changes
- All DB functions converted from sync to async
- CLI uses `await getDb()`, `await runMigrations()`, `program.parseAsync()`
- TUI dashboard uses async model building with `useState` + `useEffect` refresh
- Date normalization layer handles `2025-04-25 00:00:00+00` → `2025-04-25` for date-only values

### Test infrastructure
- Shared in-memory PGlite instance via `tests/helpers/db.ts`
- TRUNCATE-based isolation (sub-millisecond vs 3s per-process WASM init)
- CLI integration tests use 30s timeout for WASM cold start
- All 76 tests pass

### Files changed
- `src/db/index.ts`, `src/db/schema.ts`, `src/db/migrations.ts`
- `src/observers/lint/db.ts`, `commands.ts`, `detector.ts`, `status.ts`
- `src/observers/memory/db.ts`, `commands.ts`, `status.ts`, `working-db.ts`
- `src/cli/index.ts`, `src/tui/dashboard.tsx`
- `drizzle.config.ts`, `index.ts`, `package.json`
- All 20 test files

### Unlocks
- `lasso-c3e7` (semantic recall with vector search via pgvector) is no longer blocked
