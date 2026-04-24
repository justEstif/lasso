# lasso

Harness-agnostic observational memory for coding agents.

`lasso` watches agent work locally, stores useful observations, and helps turn repeated corrections into durable rules.

## What it does

- **Memory** — record project and user preferences for future context.
- **Lint observations** — detect repeated corrections and propose lint rules.
- **Status UI** — inspect observer state from the CLI or TUI.

## Install

With Bun:

```bash
bun install -g @justestif/lasso
```

With npm:

```bash
npm install -g @justestif/lasso
```

With Homebrew:

```bash
brew tap justEstif/tap
brew install lasso
```

Check the CLI:

```bash
lasso --help
```

## Setup

Run setup from the project you want lasso to manage:

```bash
lasso setup
```

This creates:

```txt
.lasso/config.json
.pi/extensions/lasso.ts
```

Then reload Pi:

```txt
/reload
```

The Pi extension adds:

```txt
/lasso-status
```

## Observers

Enable both observers:

```bash
lasso setup --observers lint,memory
```

Or enable one:

```bash
lasso setup --observers memory
lasso setup --observers lint
```

The lint observer needs a detector command. The command reads the detector prompt from stdin and writes detector JSON to stdout.

```bash
lasso setup --observers lint --detector-command "your-detector-command"
```

You can also configure it later in `.lasso/config.json` or pass it per scan:

```bash
lasso lint scan --detector-command "your-detector-command"
```

## Common commands

```bash
lasso status
lasso tui
lasso tui --once
```

Memory:

```bash
lasso memory observe --content "User prefers Bun.write for file writes."
lasso memory reflect --content "Prefer Bun.file/Bun.write for Bun file IO."
lasso memory status
lasso memory export
```

Lint:

```bash
lasso lint scan --input transcript.txt --detector-command "your-detector-command"
lasso lint list
lasso lint show <id-or-prefix>
lasso lint accept <id-or-prefix>
lasso lint reject <id-or-prefix>
lasso lint defer <id-or-prefix>
lasso lint implement <id-or-prefix>
lasso lint export
```

Manage observers:

```bash
lasso enable lint
lasso disable memory
```

## Local data

Lasso stores project-local state in:

```txt
.lasso/config.json
.lasso/lasso.db
```

The database is SQLite and uses Drizzle migrations from `drizzle/`.

When you run `lasso` from a subdirectory, it walks upward to find the nearest `.lasso/config.json` and uses that project database. To override the project location, set `LASSO_PATH` to either the project root or the `.lasso` directory:

```bash
LASSO_PATH=/path/to/project lasso status
LASSO_PATH=/path/to/project/.lasso lasso status
```

## Development

```bash
bun install
bun run format:check
bun run lint
bun test
```

## Release

Publish releases through GitHub Actions by pushing a version tag:

```bash
git tag v0.1.0
git push origin main --tags
```

The release workflow publishes to npm and updates the Homebrew tap.
