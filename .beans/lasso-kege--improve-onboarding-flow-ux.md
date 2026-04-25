---
# lasso-kege
title: Improve onboarding flow UX
status: completed
type: feature
priority: high
created_at: 2026-04-25T01:12:54Z
updated_at: 2026-04-25T01:15:44Z
---

Review and improve the lasso onboarding/setup flow, which currently feels clunky.

- [x] Identify current onboarding friction
- [x] Propose simpler setup flow
- [x] Implement approved changes
- [x] Update tests/docs
- [x] Run validation

## Target Shape

Default setup should be boring and automatic:

```bash
lasso setup
```

- create .lasso/config.json
- enable lint + memory
- detect Pi when possible
- generate/install Pi extension when Pi is selected/detected
- ensure local SQLite files are gitignored
- print a short summary and one clear next step

Additional modes:

- `lasso setup --yes` for non-interactive defaults
- `lasso setup --advanced` for harness/observer/detector options
- `lasso doctor` for setup diagnostics

Preferred output style:

```txt
lasso is ready.

Created:
  .lasso/config.json
  .pi/extensions/lasso.ts

Enabled observers:
  lint    captures recurring correction/rule candidates
  memory  captures useful session memory

Next:
  Restart Pi or run /reload, then try /lasso status
```

## Summary of Changes

Simplified setup output around a boring default flow. `lasso setup` now prints a concise ready message with created/skipped files, enabled observers, and one Pi-specific next step. Setup also ensures .gitignore contains local SQLite/debug artifacts. Added `--yes`, `--advanced`, and a lightweight `lasso doctor` command for diagnostics. Updated setup tests for the new output and gitignore behavior.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
