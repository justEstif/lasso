---
# lasso-4bmh
title: Move Pi extension template into file
status: completed
type: task
priority: normal
created_at: 2026-04-24T20:15:47Z
updated_at: 2026-04-24T20:16:39Z
---

Replace inline generated Pi extension lines with an external template file loaded as text, using Bun/JS file APIs.

- [x] Confirm recommended JS/Bun read-file-as-string approach
- [x] Move Pi extension template into standalone file
- [x] Update setup generation to read template
- [x] Update tests
- [x] Run format, lint, and tests

## Summary of Changes

- Confirmed Bun documentation recommends `Bun.file(path).text()` to read a file as a string.
- Moved the generated Pi extension source out of inline string arrays and into `src/onboarding/templates/pi-extension.ts`.
- Updated setup generation to load that template with `Bun.file(new URL(..., import.meta.url)).text()`.
- Preserved the non-blocking lifecycle hook behavior in the standalone template.

## Validation

- `bun run format:check`
- `bun run lint`
- `bun test`
