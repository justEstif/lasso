---
# lasso-n7np
title: Replace adapter contract doc with TypeScript interface
status: completed
type: task
priority: normal
created_at: 2026-04-25T00:58:25Z
updated_at: 2026-04-25T00:59:22Z
parent: lasso-9t4h
---

Remove standalone harness adapter contract documentation and encode the adapter contract as a TypeScript type/interface in source.

- [x] Remove docs/harness-adapter-contract.md
- [x] Add source-level adapter contract type
- [x] Update references/tests as needed
- [x] Run format, lint, tests, and typecheck

## Summary of Changes

Removed the standalone contract markdown and encoded the harness adapter contract as TypeScript interfaces in src/adapters/contract.ts. Added Pi adapter capability metadata using the new interface and test coverage for those capabilities. Updated the completed epic summary to reference the source interface instead of the removed doc.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
