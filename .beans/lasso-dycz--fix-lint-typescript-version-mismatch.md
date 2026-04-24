---
# lasso-dycz
title: Fix lint TypeScript version mismatch
status: completed
type: bug
priority: normal
created_at: 2026-04-24T13:13:01Z
updated_at: 2026-04-24T13:14:10Z
---

Resolve TypeScript/ESLint version mismatch so bun run lint works reliably.

## Summary of Changes\n- Replaced unsupported TypeScript beta peer dependency with TypeScript 5.9.3 dev dependency\n- Regenerated Bun lockfile\n- Verified bun run lint emits no TypeScript support warning\n- Ran format check and full bun test successfully
