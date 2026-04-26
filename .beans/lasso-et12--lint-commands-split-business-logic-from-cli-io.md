---
# lasso-et12
title: 'Lint commands: split business logic from CLI I/O'
status: completed
type: task
priority: normal
created_at: 2026-04-26T13:26:49Z
updated_at: 2026-04-26T14:08:06Z
parent: lasso-4z4e
---

Same pattern as memory. handleLintScan reads stdin + calls detector + persists + prints. Split: pure orchestration returns result, thin wrapper prints. Scan lifecycle becomes unit-testable.

## Summary\n\nSquad completed. Fixed lint violations (max-params, complexity, max-lines-per-function, nested templates, slow regex). Split into pure orchestration (executeLintScan, executeLintTransition, getLintListData, getLintShowData, buildLintExportMarkdown, formatLintStatusText) + thin CLI wrappers.
