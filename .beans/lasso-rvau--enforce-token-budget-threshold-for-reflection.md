---
# lasso-rvau
title: Enforce token-budget threshold for reflection
status: completed
type: feature
priority: normal
created_at: 2026-04-25T15:19:45Z
updated_at: 2026-04-25T20:58:16Z
parent: lasso-93aq
---

Run the reflector when observations exceed the reflection threshold, not just on Pi compaction events.

Current: reflector only fires on session_before_compaction (Pi-specific compaction hook).
Target: reflector also fires when total observation tokens exceed reflectionThreshold (40K default).

Implementation:
- Estimate total observation token count after each observation
- If threshold exceeded, trigger reflection automatically (async, non-blocking)
- Keep compaction hook as an additional trigger (orthogonal, not replacement)
- Reflection consolidates observations, drops superseded ones, keeps the event log bounded

The config already has reflectionThreshold: 40_000 — enforce it.

## Summary of Changes

### Modified files
- **`src/observers/memory/db.ts`** — Added `ShouldReflectResult` interface and `checkShouldReflect(db, scope, threshold)` function that checks if last observed tokens exceed the reflection threshold.
- **`src/observers/memory/commands.ts`** — Added `handleMemoryShouldReflect(db, config)` handler.
- **`src/cli/index.ts`** — Registered `lasso memory should-reflect` subcommand.
- **`src/onboarding/templates/pi-extension.ts.template`** — Added `buildAutoReflectionPrompt` and `triggerReflectionIfNeeded`. After each observation, checks `should-reflect` and auto-triggers reflection via the Pi model if threshold exceeded (async, non-blocking). Compaction hook remains as an additional trigger.
- **`tests/memory-cli.test.ts`** — Added CLI integration test for `should-reflect` threshold enforcement.
- **`tests/memory-db.test.ts`** — Added DB-level test for `checkShouldReflect`.

### Verification
- All 67 tests pass (was 65, now 67 with 2 new reflection threshold tests)
- TypeScript types clean
- ESLint clean on all touched files
- Prettier formatted
