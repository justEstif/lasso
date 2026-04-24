---
# lasso-dj8s
title: Run TypeScript typecheck
status: completed
type: task
priority: normal
created_at: 2026-04-24T20:17:26Z
updated_at: 2026-04-24T20:18:49Z
---

Run TypeScript compiler/typecheck after recent template and model changes.

- [x] Identify typecheck command
- [x] Run TypeScript compiler
- [x] Report any errors

## Summary of Changes

- Added `bunx tsc --noEmit` to `AGENTS.md` as a required build verification step.
- Ran `bunx tsc --noEmit`, found type errors, and fixed them.
- Excluded the generated Pi extension template from project typechecking by storing it as a `.ts.template` text template.
- Tightened config merging to use object guards before spreading unknown JSON values.
- Converted `LintStatus` to a type-only import.
- Adjusted package metadata test typing for optional `private`.

## Validation

- `bunx tsc --noEmit`
- `bun run format`
- `bun run lint`
- `bun test`
- `bun run format:check`
