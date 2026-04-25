---
# lasso-f1w3
title: Enrich observation format to structured event log
status: todo
type: feature
created_at: 2026-04-25T15:19:17Z
updated_at: 2026-04-25T15:19:17Z
parent: lasso-93aq
---

Switch from a single summary blob to Mastra-style dated, prioritized event log observations stored in SQLite.

Current: observer returns a single summary string, stored as one `content` field.
Target: structured observation entries with date, priority (🔴🟡🟢), and event details.

Since we have the CLI and database, store structured observations as rows:
- Add observation_entries table (or enrich memory_snapshots schema)
- Each entry: date, priority level, content text, parent snapshot ID
- Observer prompt produces structured event log (dated bullets with emoji priorities)
- CLI can query/filter by priority and date
- Export command renders formatted event log

Benefits: denser context, better reflection input, queryable by priority/date.
