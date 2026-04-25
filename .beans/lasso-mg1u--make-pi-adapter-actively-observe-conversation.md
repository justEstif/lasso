---
# lasso-mg1u
title: Make Pi adapter actively observe conversation
status: completed
type: feature
priority: high
created_at: 2026-04-25T00:51:38Z
updated_at: 2026-04-25T00:57:06Z
parent: lasso-9t4h
---

Bring lasso back in line with the MVP spec: Pi adapter should pass conversation context to lasso observers, not only update status.

- [x] Make lint scan accept stdin conversation input by default
- [x] Add Pi conversation serialization in generated extension
- [x] Run lint scan and memory observe asynchronously on lifecycle hooks with conversation input
- [x] Add slash-command mirrors for lasso observer commands
- [x] Add active status footer with observer state
- [x] Add tests for generated Pi extension and CLI stdin paths
- [x] Run format, lint, tests, and TypeScript check

## Summary of Changes

Implemented the active Pi adapter loop. lint scan now reads piped stdin by default. The generated Pi extension serializes Pi conversation messages, asynchronously invokes lasso lint scan and lasso memory observe with conversation input on turn end, mirrors common /lasso:* commands, and renders footer status from real lint/memory status output. Added harness adapter contract documentation and tests for generated extension behavior and CLI stdin scanning.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
