---
# lasso-x7vb
title: Lint Observer Implementation
status: in-progress
type: feature
priority: normal
created_at: 2026-04-24T11:29:46Z
updated_at: 2026-04-24T13:20:15Z
parent: lasso-os9y
blocked_by:
    - lasso-a4bo
---

- Implement lint detector running with prompt for rule candidates\n- Implement SQLite schema for lint entries\n- Add CLI commands: scan, list, show, accept, reject, defer, implement, status, export

## Progress\n- Added lint detector prompt builder with rubric, JSON contract, conversation input, and active-entry dedup context\n- Added scan options for --input, --detector-output, and --print-prompt\n- Added robust detector JSON extraction from raw/fenced text and stricter validation\n- Added active lint entry retrieval for dedup context\n- Added unit tests for prompt/parsing and CLI integration test for scan/list
