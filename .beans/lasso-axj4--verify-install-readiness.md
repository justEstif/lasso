---
# lasso-axj4
title: Verify install readiness
status: completed
type: task
created_at: 2026-04-24T20:26:11Z
updated_at: 2026-04-24T20:26:11Z
---

Check whether current README install paths should work.

- [x] Inspect package bin configuration
- [x] Run package dry-run
- [x] Explain install caveats

## Summary of Changes

Verified package dry-run includes CLI entrypoint and source files. Noted that Bun/npm global installs require the npm package to be published and Bun available for the shebang; Homebrew requires the tap formula to be published.
