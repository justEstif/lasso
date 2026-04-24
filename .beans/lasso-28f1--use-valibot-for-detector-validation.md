---
# lasso-28f1
title: Use Valibot for detector validation
status: completed
type: task
priority: normal
created_at: 2026-04-24T13:21:30Z
updated_at: 2026-04-24T13:22:59Z
parent: lasso-x7vb
---

Replace hand-rolled lint detector output validation with Valibot schemas and add invalid-output tests.

## Summary of Changes\n- Added Valibot dependency\n- Replaced hand-rolled lint detector validation with Valibot schemas\n- Kept JSON extraction behavior for raw/fenced/embedded detector output\n- Added invalid detector output tests\n- Verified format, lint, and full bun test pass
