# lasso

Agent memory + lint rules. Local-first, harness-agnostic.

Records observations, detects repeated corrections, surfaces context when agents start new sessions.

## Install

```bash
bun install -g @justestif/lasso
# or
npm install -g @justestif/lasso
# or
brew tap justEstif/tap && brew install lasso
```

## Setup

```bash
cd your-project
lasso setup                    # Pi (default)
lasso setup --harness opencode  # opencode
lasso setup --harness claude    # Claude Code
```

Creates `.lasso/config.json`, the harness adapter files, and `.gitignore` entries.

| Harness    | Generated files                                                      |
| ---------- | -------------------------------------------------------------------- |
| `pi`       | `.pi/extensions/lasso.ts`                                            |
| `opencode` | `.opencode/plugins/lasso.ts`                                         |
| `claude`   | `.claude/hooks/lasso-user-prompt-submit.ts`, `.claude/settings.json` |

## Observers

Two observers, both enabled by default.

### Memory

Records project facts, decisions, preferences. Surfaces them as context on session start.

```bash
# record an observation (or pipe content via stdin)
lasso memory observe --content "User prefers Bun.write over node:fs"

# query stored memory
lasso memory context --query "file writes"

# consolidate observations into a reflection
lasso memory reflect --content "Prefer Bun native APIs for all IO"

# status + export
lasso memory status
lasso memory export
```

Observations are parsed into structured entries with priority (🔴 high, 🟡 medium, 🟢 low), categories, and optional temporal anchors (`[ref:YYYY-MM-DD]`, `[rel:+Nd]`).

### Lint

Detects recurring corrections in conversation. Proposes enforceable lint rules.

```bash
# scan needs a detector command (reads prompt stdin, writes JSON stdout)
lasso setup --detector-command "your-llm-detector"

# or pass per-scan
lasso lint scan --detector-command "your-llm-detector" --input transcript.txt

# triage results
lasso lint list
lasso lint show <id>
lasso lint accept <id>
lasso lint reject <id>
lasso lint defer <id>
lasso lint implement <id>
lasso lint export
```

## Commands

```bash
lasso status              # combined observer status
lasso tui                 # interactive dashboard
lasso tui --once          # render one frame, exit
lasso doctor              # check setup health
lasso enable <observer>   # enable lint or memory
lasso disable <observer>  # disable lint or memory
```

## Architecture

- **Storage**: SQLite via `bun:sqlite` + Drizzle ORM. Project-local at `.lasso/db.sqlite`.
- **Search**: FTS5 full-text search with BM25 ranking.
- **Observers**: shared lifecycle — token budget gates → observe → persist progress.
- **CLI**: thin Commander router → observer modules own registration + handlers.
- **Harness adapters**: context injection per agent —
  - **Pi**: `.pi/extensions/lasso.ts`. Hooks: `session_start`, `turn_end`, `before_agent_start`, `session_before_compact`.
  - **opencode**: `.opencode/plugins/lasso.ts`. Hooks: `chat.message`, `experimental.chat.system.transform`.
  - **Claude Code**: `.claude/hooks/lasso-user-prompt-submit.ts` + `.claude/settings.json`. Hook: `UserPromptSubmit` → `additionalContext`.

## Project resolution

Lasso walks upward from CWD to find `.lasso/config.json`. Override with `LASSO_PATH`:

```bash
LASSO_PATH=/path/to/project lasso status
```

## Development

```bash
bun install
bun test                  # 100 tests
bunx tsc --noEmit         # type check
bunx eslint src/ tests/   # lint
```

## Release

```bash
git tag v0.1.3
git push origin main --tags
```

GitHub Actions publishes to npm + updates Homebrew tap.
