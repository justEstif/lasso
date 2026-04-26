---
# lasso-m1ei
title: 'Observer lifecycle: unify lint + memory gate pattern'
status: completed
type: task
priority: normal
created_at: 2026-04-26T13:26:49Z
updated_at: 2026-04-26T14:08:06Z
parent: lasso-4z4e
---

service.ts has deep gate-check + runObserverLifecycle. Lint uses it, memory doesn't (persists progress manually). Make both observers use shared lifecycle. Observer provides config + callback.

## Summary\n\nSquad completed. handleMemoryObserve now uses runObserverLifecycle with tokenBudget gate, consistent with lint observer pattern.
