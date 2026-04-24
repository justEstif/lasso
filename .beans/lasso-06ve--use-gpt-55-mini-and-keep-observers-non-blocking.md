---
# lasso-06ve
title: Use GPT-5.5 mini and keep observers non-blocking
status: completed
type: task
priority: normal
created_at: 2026-04-24T20:10:32Z
updated_at: 2026-04-24T20:11:26Z
---

Set default observer model to GitHub Copilot GPT-5.5 mini and audit/adjust Pi observer hooks so lasso does not block the main agent turn.

- [x] Change default observer model to GPT-5.5 mini
- [x] Inspect Pi extension hook blocking behavior
- [x] Make generated Pi observer hooks fire-and-forget where appropriate
- [x] Add or update tests
- [x] Run format, lint, and tests

## Summary of Changes

- Changed the shared default observer model to `github-copilot/gpt-5.5-mini` so lint, memory observe, and memory reflect defaults stay on the cheaper Copilot mini model.
- Updated generated Pi lifecycle hooks to fire-and-forget status checks with `void runLasso(...)`, so session_start and turn_end hooks do not await lasso status work before returning.
- Kept the explicit `lasso-status` command blocking by design because the user asked for command output.
- Added setup integration assertions that generated turn_end hooks are non-async/non-blocking.

## Validation

- `bun run format`
- `bun run format:check`
- `bun run lint`
- `bun test`
