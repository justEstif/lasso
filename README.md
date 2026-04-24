# lasso

Harness-agnostic observational memory and linting for coding agents.

`lasso` gives agent harnesses a small local CLI for:

- **lint observations** — detect recurring user corrections and turn them into proposed lint rules.
- **memory observations** — store useful project/thread observations and reflections for future context.
- **TUI status** — inspect observer state from a terminal dashboard.

## Requirements

- [Bun](https://bun.com)

## Install

```bash
bun install -g @justestif/lasso
```

Check the CLI:

```bash
lasso --help
```

## Setup

Run setup from the project you want lasso to manage:

```bash
lasso setup --harness pi
```

Pi is the default harness, so this is equivalent:

```bash
lasso setup
```

Setup creates:

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

## Choosing observers

Enable both first-party observers:

```bash
lasso setup --harness pi --observers lint,memory
```

Memory only:

```bash
lasso setup --harness pi --observers memory
```

Lint only:

```bash
lasso setup --harness pi --observers lint
```

Observer descriptions:

- `lint` — detects recurring corrections and proposes lint rules.
- `memory` — stores observations and reflections for future context.

## Lint detector command

The lint observer needs a detector to analyze conversation history and propose lint entries.

A detector command:

1. reads the lasso detector prompt from stdin
2. writes detector JSON to stdout

Configure it during setup:

```bash
lasso setup --harness pi --detector-command "your-detector-command"
```

Or later in `.lasso/config.json`:

```json
{
  "observers": {
    "lint": {
      "enabled": true,
      "detectorCommand": "your-detector-command"
    }
  }
}
```

You can also pass it per scan:

```bash
lasso lint scan --detector-command "your-detector-command"
```

For tests/manual use, provide detector JSON directly:

```bash
lasso lint scan --detector-output detector.json
```

## Common commands

Combined status:

```bash
lasso status
```

Terminal dashboard:

```bash
lasso tui
```

One-shot dashboard render:

```bash
lasso tui --once
```

Lint observer:

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

Memory observer:

```bash
lasso memory observe --content "User prefers Bun.write for file writes."
lasso memory reflect --content "Prefer Bun.file/Bun.write for Bun file IO."
lasso memory status
lasso memory export
```

Enable or disable observers:

```bash
lasso enable lint
lasso disable memory
```

## Local data

Project-local lasso state lives in:

```txt
.lasso/config.json
.lasso/lasso.db
```

The database is SQLite and uses Drizzle-generated migrations from `drizzle/`.

## Release checklist

Before publishing:

```bash
bun run format:check
bun run lint
bun test
bun pm pack --dry-run
```

Install-smoke the packed tarball from a temp project:

```bash
bun pm pack --filename /tmp/lasso-smoke.tgz --quiet
mkdir -p /tmp/lasso-smoke-install
cd /tmp/lasso-smoke-install
bun init -y
bun add /tmp/lasso-smoke.tgz
bunx lasso --help
bunx lasso setup --harness pi --observers memory
bunx lasso status
```

Publish manually:

```bash
bun publish --access public
```

Or publish through GitHub Actions:

1. Add repository secrets:
   - `NPM_TOKEN` — npm automation token allowed to publish `@justestif/lasso`.
   - `TAP_GITHUB_TOKEN` — GitHub token allowed to push to `justEstif/homebrew-tap`.
2. Bump `package.json` version.
3. Commit the version bump.
4. Create and push a matching tag:

```bash
git tag v0.1.0
git push origin main --tags
```

The release workflow publishes to npm and updates the Homebrew tap formula.

## Homebrew

After the tap formula is available:

```bash
brew tap justEstif/tap
brew install lasso
```

## Development

Install dependencies:

```bash
bun install
```

Run checks:

```bash
bun run format:check
bun run lint
bun test
```
