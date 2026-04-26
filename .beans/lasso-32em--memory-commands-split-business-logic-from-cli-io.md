---
# lasso-32em
title: 'Memory commands: split business logic from CLI I/O'
status: completed
type: task
priority: normal
created_at: 2026-04-26T13:26:49Z
updated_at: 2026-04-26T13:59:32Z
parent: lasso-4z4e
---

handleMemoryObserve/Context/Export contain options reading + DB calls + console.log. Split: pure fn returns structured result, thin CLI wrapper prints. Enables unit testing without subprocess.

## Summary\n\nSplit each handler into pure orchestration + thin CLI wrapper. Added getMemoryContextText, getMemoryExportText, getMemoryStatusText, executeMemoryObserve, executeMemoryReflect, executeWorkingMemoryAction. CLI wrappers just console.log the results.
