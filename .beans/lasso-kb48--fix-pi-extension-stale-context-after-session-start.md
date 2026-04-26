---
# lasso-kb48
title: Fix Pi extension stale context after session_start
status: completed
type: bug
priority: normal
created_at: 2026-04-26T14:20:31Z
updated_at: 2026-04-26T14:23:10Z
---

Pi session_start extension hook crashes with stale ctx after injecting lasso memory context.

- [x] Locate current Pi extension template
- [x] Fix stale ctx usage in session_start
- [x] Regenerate /tmp/lasso-setup-test extension with dev lasso path
- [x] Verify pi prompt no stale ctx crash
- [x] Run bun test
- [x] Run bunx tsc --noEmit
- [x] Run bunx eslint
- [x] Commit and push

## Summary of Changes

- Guarded Pi extension UI status/notification calls so async callbacks from old session contexts ignore stale-context errors instead of crashing.
- Regenerated the test Pi extension with the dev lasso path and verified the memory answer path no longer emits the stale ctx crash.
- Fixed repo lint issues surfaced by `bunx eslint` in `eslint.config.js` and `index.ts`.
- Verified with `pi`, `bun test`, `bunx tsc --noEmit`, and `bunx eslint`.
