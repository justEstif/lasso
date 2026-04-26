---
# lasso-zebd
title: 'Lint status: use GROUP BY instead of loading all entries'
status: completed
type: task
priority: normal
created_at: 2026-04-26T13:26:49Z
updated_at: 2026-04-26T13:56:17Z
parent: lasso-4z4e
---

buildLintStatusModel calls listEntries() (no limit), counts in JS. Add countByStatus(db) using SQL GROUP BY. Status model stays same interface, faster + less memory.

## Summary\n\nAdded countByStatus(db) using SQL GROUP BY and countStaleProposed(db, days) using WHERE filter. Status model uses these instead of loading all entries for counting. countLintStatuses kept for backward compat.
