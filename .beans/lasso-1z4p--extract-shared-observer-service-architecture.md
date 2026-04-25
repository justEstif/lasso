---
# lasso-1z4p
title: Extract shared observer service architecture
status: completed
type: epic
priority: normal
created_at: 2026-04-25T15:58:44Z
updated_at: 2026-04-25T21:16:47Z
blocking:
    - lasso-3tgk
blocked_by:
    - lasso-93aq
---

Factor out shared observer patterns into a service that all observers (memory, lint, future) register with.

## Problem
Both memory and lint observers duplicate the same lifecycle: turn_end trigger → serialize conversation → check thresholds → call LLM → persist results → update status. Adding a 3rd observer means copying it again.

## What the service owns
- Trigger gating (token budget, turn count, throttle) — shouldObserve()
- Conversation serialization and unobserved delta tracking
- Lifecycle: observe() → persist() → reflect()
- Temporal base schema (observed_at, referenced_date, relative_offset)
- Dedup primitives (hash, fingerprint, similarity)
- DB connection and status bar updates
- Observer registration and discovery

## What each observer provides (plugin interface)
- Name and config shape
- shouldObserve override (custom logic beyond token budget)
- Prompt builder (conversation → LLM prompt)
- Result parser (LLM output → structured data)
- Schema extension (observer-specific columns/tables)
- Status summary fn

## Why after memory observer
Ship memory observer improvements first — they prove the patterns work. Then extract into a service as a refactoring step. This gives us a clean plugin API before we tackle lint optimization and any future observers.

## Dependency chain
- Blocked by: lasso-93aq (memory observer optimization)
- Blocks: lasso-3tgk (lint observer optimization), future observers

## Work Plan

- [x] Inspect current memory and lint observer architecture
- [x] Design shared observer service alternatives
- [x] Implement shared observer primitives
- [x] Port memory observer to shared service
- [x] Add unit and integration tests
- [x] Run formatter, linter, tests, and typecheck

## Summary of Changes

Started the shared observer architecture by extracting common token-budget and saturation gates into `src/observers/service.ts`. Ported memory should-observe logic to the shared token gate, exposed lint scan gating through the same primitives, and reused the saturation gate in lint status output. Added focused unit coverage and ran formatter, linter, full test suite, and TypeScript typecheck.

## Remaining Follow-up

- [x] Extract full observe/persist/reflect lifecycle after current callers converge on shared gates
- [x] Port lint scanner execution to enforce scan thresholds once lint token state persistence exists

## Final Completion Summary

Completed the epic by adding a shared observer lifecycle runner that gates observations, runs observer-specific work, and persists progress only after non-skipped observations. Added lint observation token state persistence and wired `lint scan` to enforce `scanThresholdTokens` unless `--force` is provided. Added a Drizzle migration for lint observation state and expanded tests for lifecycle behavior, lint threshold skipping, and migration count.

Validation passed: `bun run format`, `bun run lint`, `bun test` (76 passing), and `bunx tsc --noEmit`.
