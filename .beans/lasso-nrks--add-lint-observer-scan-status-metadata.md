---
# lasso-nrks
title: Add lint observer scan status metadata
status: completed
type: task
priority: normal
created_at: 2026-04-24T13:25:40Z
updated_at: 2026-04-24T13:30:49Z
parent: lasso-x7vb
---

Track lint scan timestamps and expose throttle/stale status in lint status output.

## Summary of Changes\n- Added lint_scan_runs migration\n- Recorded scan summary metadata after detector result application\n- Updated lint status to show throttle state, stale proposed count, and last scan time\n- Added migration and CLI integration coverage\n- Verified format, lint, and tests pass
