---
# lasso-a0hf
title: Enforce token-budget triggers for memory observation
status: completed
type: feature
priority: high
created_at: 2026-04-25T15:14:36Z
updated_at: 2026-04-25T15:40:04Z
parent: lasso-93aq
---

The config has `observationThreshold: 12_000` tokens but it's never enforced — the observer runs on every `turn_end`. Mastra only triggers at 30K tokens of unobserved history.

- Track unobserved token count per thread in the DB (or estimate from conversation length)
- Only invoke the LLM observer when unobserved tokens exceed the threshold
- The Pi extension should check the threshold before calling `persistMemoryObservation`
- Falls back to snapshotting on every turn if threshold is 0 (backward compat)

This is the single highest-impact optimization — cuts observer invocations by ~95%.



## Summary of Changes

Enforced token-budget triggers for memory observation. The observer now only runs when unobserved conversation tokens exceed the configured `observationThreshold` (default: 12,000).

### Files changed
- `src/observers/memory/tokens.ts` — new `estimateTokens()` utility (chars / 4 heuristic)
- `src/observers/memory/db.ts` — added `getObservationState()` and `recordObservationTokenCount()` for tracking last-observed tokens
- `src/observers/memory/commands.ts` — added `checkShouldObserve()` + `handleMemoryShouldObserve()`; `handleMemoryObserve()` now records token count
- `src/cli/index.ts` — added `memory should-observe --tokens <N>` CLI command
- `src/db/schema.ts` — added `memory_observation_state` table
- `src/adapters/pi/lasso.ts` — added `memory-should-observe` command mapping
- `src/onboarding/templates/pi-extension.ts.template` — Pi extension now checks token budget before invoking LLM observer
- `drizzle/` — regenerated single migration with all tables
- `eslint.config.js` — allow `process.exit` in CLI command files
- Tests: new should-observe integration test, updated migration count and setup expectations
