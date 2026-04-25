---
# lasso-cgox
title: Add working memory scratchpad
status: completed
type: feature
priority: normal
created_at: 2026-04-25T15:20:04Z
updated_at: 2026-04-25T20:50:19Z
parent: lasso-93aq
---

A small structured markdown block that's always in context, complementing observations. Stored in DB, updated independently.

Mastra's working memory is like the agent's active thoughts — persistent facts about the user/project that should always be available. Unlike observations (event log), working memory is a living document.

Implementation:
- Add working_memory table: id, resource_id, thread_id, content (markdown), updated_at
- Default template: project name, tech stack, current task, open questions
- CLI commands: `lasso memory working` to view/edit
- Pi extension injects working memory into system prompt on every turn
- Updated by the observer when facts change (not on every turn)

Scope: thread-scoped or resource-scoped (same as observations config).

This is separate from observations — observations are append-only events, working memory is mutable state.

## Summary of Changes

### New files
- **`src/observers/memory/working-db.ts`** — Working memory CRUD: `upsertWorkingMemory`, `getWorkingMemory`, `listAllWorkingMemory`, `removeWorkingMemory`, `getDefaultTemplate`. Supports exact scope matching by resource_id and/or thread_id.
- **`tests/working-db.test.ts`** — 10 tests covering upsert, retrieval, removal, and default template.

### Modified files
- **`src/db/schema.ts`** — Added `workingMemory` table (id, resource_id, thread_id, content, updated_at).
- **`drizzle/0003_robust_star_brand.sql`** — Auto-generated migration for working_memory table.
- **`src/observers/memory/commands.ts`** — Added `handleMemoryWorking` dispatch and helpers: `handleWorkingEdit`, `handleWorkingInit`, `handleWorkingReset`, `handleWorkingShow`.
- **`src/cli/index.ts`** — Registered `lasso memory working` subcommand with --init, --edit, --reset, --resource-id, --thread-id flags.
- **`src/onboarding/templates/pi-extension.ts.template`** — `before_agent_start` hook now fetches working memory alongside observation context and injects both into the system prompt.
- **`tests/db.test.ts`** — Updated migration count expectations from 3 to 4.

### Verification
- All 65 tests pass (was 55, now 65 with 10 new working memory tests)
- TypeScript types clean (`bunx tsc --noEmit`)
- ESLint clean on all touched files
- Prettier formatted
