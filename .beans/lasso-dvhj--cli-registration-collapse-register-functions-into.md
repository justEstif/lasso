---
# lasso-dvhj
title: 'CLI registration: collapse register functions into observer modules'
status: completed
type: task
priority: normal
created_at: 2026-04-26T13:26:49Z
updated_at: 2026-04-26T14:08:05Z
parent: lasso-4z4e
blocked_by:
    - lasso-32em
    - lasso-et12
---

Each observer's command registration + handler belong together. CLI entry point becomes thin router wiring observer command groups. registerMemoryCommands/registerLintCommands helpers + inline handlers move to their observer modules.

## Summary\n\nMoved command registration into each observer's cli.ts module (lint/cli.ts, memory/cli.ts). cli/index.ts is now a thin router calling registerLintCli + registerMemoryCli. Extracted setup/status/tui into smaller registration functions.
