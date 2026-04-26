---
# lasso-xqzi
title: 'FTS5 query dedup: extract shared search builder'
status: completed
type: task
priority: normal
created_at: 2026-04-26T13:26:49Z
updated_at: 2026-04-26T14:08:06Z
parent: lasso-4z4e
---

searchEntries + searchSnapshots duplicate query normalization + FTS5 JOIN pattern. Extract buildFtsQuery() + generic ftsSearch(). Adding new searchable entity = one call, not copy-paste.

## Summary\n\nSquad completed. Extracted buildFtsQuery() and ftsSearch() helper. searchEntries and searchSnapshots now use shared FTS5 infrastructure.
