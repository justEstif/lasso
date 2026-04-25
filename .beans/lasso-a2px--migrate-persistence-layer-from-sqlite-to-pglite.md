---
# lasso-a2px
title: Migrate persistence layer from SQLite to PGlite
status: draft
type: epic
priority: low
created_at: 2026-04-25T15:17:48Z
updated_at: 2026-04-25T15:18:00Z
---

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
