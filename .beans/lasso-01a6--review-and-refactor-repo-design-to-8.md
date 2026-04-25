---
# lasso-01a6
title: Review and refactor repo design to 8+
status: completed
type: task
priority: normal
created_at: 2026-04-25T21:10:16Z
updated_at: 2026-04-25T21:11:51Z
---

Apply philosophy-software-design review mode to the whole repo, refactor highest-impact design issues, and validate the result.

- [x] Inventory source modules and architecture
- [x] Identify top design red flags and baseline score
- [x] Refactor highest-impact issues
- [x] Add/update tests for refactors
- [x] Run formatter, linter, tests, and typecheck
- [x] Record final score and summary

## Design Review

Baseline score: 7/10. The repo already had clear feature slices and strong tests, but status semantics leaked across CLI and TUI surfaces. That caused change amplification: a change to lint throttle/stale status or memory recency semantics required remembering to update multiple renderers.

Primary red flags addressed:
- Information leakage: CLI and TUI both knew how to compute lint status counts, stale proposed counts, throttle state, memory counts, and last-record timestamps.
- Change amplification: status display behavior was duplicated across observer command modules and the dashboard.
- Cognitive load: renderers mixed persistence queries, status policy, and presentation.

## Summary of Changes

Extracted deep status model modules for observer status semantics:
- `src/observers/lint/status.ts` centralizes lint counts, throttle saturation, stale proposed count, last scan, and entries.
- `src/observers/memory/status.ts` centralizes memory counts, last snapshot/reflection, and recent records.
- Refactored lint CLI status, memory CLI status, and TUI dashboard model construction to consume these status models.
- Added `tests/observer-status.test.ts` so the shared status semantics are covered independently.

Validation passed: `bun run format`, `bun run lint`, `bun test` (73 passing), and `bunx tsc --noEmit`.

Final score: 8/10. The highest-impact leakage between persistence/status policy and renderers is now encapsulated. To reach 9, the next useful improvement would be separating command IO/process-exit behavior from pure command use cases, especially in `src/observers/*/commands.ts`, without over-abstracting the small CLI surface.
