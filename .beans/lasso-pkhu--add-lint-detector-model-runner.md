---
# lasso-pkhu
title: Add lint detector model runner
status: completed
type: task
priority: normal
created_at: 2026-04-24T13:49:51Z
updated_at: 2026-04-24T13:53:03Z
parent: lasso-x7vb
---

Add a detector runner abstraction for lint scan so it can invoke a configured command/model instead of requiring --detector-output JSON.

## Summary of Changes\n- Added lint detector runner abstraction that invokes a configured shell command with the detector prompt on stdin\n- Added observers.lint.detectorCommand config support and --detector-command CLI override\n- Kept --detector-output manual/test bypass and --print-prompt workflow\n- Added unit tests for runner success/missing command/failure paths\n- Added CLI integration test for command-backed lint scan\n- Verified format, lint, and full test suite pass
