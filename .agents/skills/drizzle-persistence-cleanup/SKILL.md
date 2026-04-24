---
name: drizzle-persistence-cleanup
version: 1.0.0
description: Use when a TypeScript/Bun project has Drizzle installed but code is still using raw SQLite SQL for normal CRUD, when bun:sqlite exec deprecation diagnostics appear, or when placeholder external logging such as Sentry is present without user configuration. Triggers on "why are we writing raw SQL", "Drizzle is installed", "bun:sqlite exec is deprecated", "I don't have Sentry", "remove Sentry", "use Drizzle", and persistence/logging cleanup requests.
triggers:
  - why are we writing raw SQL
  - Drizzle is installed
  - bun:sqlite exec is deprecated
  - I don't have Sentry
  - remove Sentry
  - use Drizzle
  - replace raw SQLite
  - persistence cleanup
  - logging cleanup
tools:
  - read
  - bash
  - edit
  - write
mutating: true
---

# Drizzle Persistence Cleanup

## Contract

Use this skill to clean up a TypeScript/Bun persistence layer when the project already has Drizzle available, raw `bun:sqlite` SQL is being used for normal repository operations, deprecated `db.exec` diagnostics appear, or placeholder external logging was scaffolded without real user configuration.

A successful run:

1. Audits installed persistence/logging dependencies and current DB call sites.
2. Keeps schema/migration strategy explicit instead of silently mixing systems.
3. Uses Drizzle for ordinary application CRUD/query repository code.
4. Uses prepared Drizzle queries for reused reads where practical.
5. Leaves raw SQL only where justified, usually DDL migrations, and avoids deprecated `db.exec` by using non-deprecated statement execution.
6. Removes unconfigured external logging services such as placeholder Sentry.
7. Replaces external logging with a local/CLI-safe logger unless the user asks for a real service.
8. Updates tests around DB behavior and CLI/integration boundaries.
9. Runs format, lint, and tests.
10. Commits code and tracking artifacts together when the project uses an issue tracker.

## Trigger / When to Use

Use this skill when the user says or implies:

- "Why are we writing raw SQL if Drizzle is installed?"
- "Can we use Drizzle instead?"
- "`db.exec` is deprecated"
- "I don't have Sentry"
- "Remove Sentry"
- "Logging should go somewhere else"
- "Clean up the DB layer"
- "Replace raw SQLite"

Also use it proactively after discovering:

- Drizzle dependencies present but repository code uses raw SQL for normal CRUD.
- Placeholder DSNs, dummy Sentry initialization, or unused remote logging dependencies.
- Deprecation diagnostics from `bun:sqlite` APIs.

## Procedure

### Phase 1: Audit current state

1. Search for persistence and logging usage:

   ```bash
   rg "drizzle|bun:sqlite|\.exec\(|prepare\(|Sentry|logger" -n . --glob '!node_modules'
   ```

2. Inspect package dependencies:

   ```bash
   bun pm ls drizzle-orm drizzle-kit @sentry/bun typescript
   ```

3. Identify which SQL is:
   - **CRUD/query code**: should usually move to Drizzle.
   - **DDL/migration code**: may remain SQL, but should avoid deprecated APIs.
   - **PRAGMA/setup code**: may remain SQLite-specific, but should avoid deprecated APIs.

4. Check whether logging is configured by the user or just scaffolded:
   - Real DSN/config + user wants it: keep and document.
   - Placeholder DSN or user does not have the service: remove dependency and replace with local logging.

### Phase 2: Convert CRUD/query code to Drizzle

1. Add or extend a Drizzle schema near the DB layer, for example:

   ```ts
   import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

   export const lintEntries = sqliteTable('lint_entries', {
     id: text('id').primaryKey(),
     status: text('status').notNull(),
     description: text('description').notNull(),
     created_at: text('created_at').notNull(),
     updated_at: text('updated_at').notNull(),
   });
   ```

2. Wire Drizzle with Bun SQLite:

   ```ts
   import type { Database } from 'bun:sqlite';
   import { drizzle } from 'drizzle-orm/bun-sqlite';

   const orm = drizzle(db);
   ```

3. Replace raw repository CRUD with Drizzle query builder:

   ```ts
   orm.insert(lintEntries).values(entry).run();

   orm
     .update(lintEntries)
     .set({ status, updated_at: new Date().toISOString() })
     .where(eq(lintEntries.id, id))
     .run();
   ```

4. Use prepared Drizzle queries for repeated reads:

   ```ts
   import { eq, sql } from 'drizzle-orm';

   const prepared = db
     .select()
     .from(lintEntries)
     .where(eq(lintEntries.id, sql.placeholder('id')))
     .prepare();

   prepared.get({ id: 'entry-id' });
   ```

5. Prefer typed repository functions over leaking Drizzle calls everywhere. Keep the rest of the app depending on domain-shaped functions such as `getEntry`, `listEntries`, and `recordScanRun`.

### Phase 3: Handle migrations deliberately

Drizzle query builder is for runtime data access. Do not pretend it removes the need for a migration strategy.

Acceptable MVP options:

- Keep a tiny handwritten migration runner for DDL, but use non-deprecated `bun:sqlite` APIs such as `db.run(...)` per statement.
- Or fully adopt `drizzle-kit` migrations if the project is ready for generated migration files and workflow.

For the MVP/local-CLI case, handwritten DDL migrations are acceptable if:

- Each migration is versioned and idempotent.
- Raw SQL is isolated to migration files.
- Deprecated `db.exec` is not used.
- Tests cover idempotency and expected tables.

### Phase 4: Remove unconfigured external logging

1. If the user does not have Sentry or the DSN is a placeholder, remove it:

   ```bash
   bun remove @sentry/bun
   ```

2. Replace with a local logger appropriate for a CLI:

   ```ts
   export const logger = {
     error: (message: string, ...details: unknown[]) => {
       console.error(message, ...details);
     },
     info: (message: string, ...details: unknown[]) => {
       console.error(message, ...details);
     },
   };
   ```

3. Do not add a new hosted logging service unless the user explicitly asks for one and provides/chooses configuration.

### Phase 5: Test and verify

Run the project’s normal checks, typically:

```bash
bun run format
bun run lint
bun test
```

Also search again to verify cleanup:

```bash
rg "\.exec\(|@sentry|Sentry" -n . --glob '!node_modules' --glob '!bun.lock'
```

Expected result: only historical docs/issues mention Sentry or deprecated APIs; source code does not.

## Quality Gates

- Drizzle schema exists for tables used by Drizzle repository code.
- Normal CRUD/query repository functions use Drizzle, not raw SQL strings.
- Repeated reads use Drizzle `.prepare()` when practical.
- Raw SQL is isolated to migrations/setup and uses non-deprecated APIs.
- No placeholder Sentry/external logging remains.
- Local logger is simple and does not require user-owned infrastructure.
- Unit/integration tests still pass.
- Lint and format pass.
- The final response explains why any remaining raw SQL remains.

## Anti-Patterns

- ❌ Installing Drizzle but continuing to hand-write all CRUD SQL.
- ❌ Replacing a small migration runner with ad hoc schema creation hidden in repository code.
- ❌ Using deprecated `db.exec` and suppressing the diagnostic.
- ❌ Keeping placeholder Sentry DSNs or external logging the user does not have.
- ❌ Adding another hosted logging vendor without user consent.
- ❌ Letting Drizzle details leak into unrelated observer/CLI logic.
- ❌ Removing all raw SQL dogmatically; DDL migrations may reasonably remain SQL.

## Filing Rules

When this skill writes durable artifacts:

- Drizzle table definitions go in the project’s DB schema module, e.g. `src/db/schema.ts`.
- Migration code stays in the migration module, e.g. `src/db/migrations.ts`.
- Domain repository code stays near the observer/domain, e.g. `src/observers/<name>/db.ts`.
- Logging facade stays in the existing logger module, e.g. `logger.ts` or `src/logger.ts`.
- If the repo uses an issue tracker, create/update the relevant task and commit tracker files with code changes.

## Output Format

When reporting back, include:

1. What was migrated to Drizzle.
2. What raw SQL remains and why.
3. What deprecated API diagnostics were removed.
4. What happened to external logging dependencies.
5. Verification commands and results.
6. Commit hash, if committed.
