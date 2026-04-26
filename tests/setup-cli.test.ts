import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const entrypoint = path.join(projectRoot, 'index.ts');

async function runLasso(cwd: string, args: string[]) {
  const proc = Bun.spawn(['bun', 'run', entrypoint, ...args], {
    cwd,
    env: { ...process.env, LASSO_PATH: '.lasso' },
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stderr, stdout };
}

describe('setup CLI integration', () => {
  test('setup creates config and optional Pi extension', testPiSetupCli);
  test('setup creates opencode plugin with full lifecycle', testOpencodeSetupCli);
  test('setup creates Claude Code hooks with full lifecycle', testClaudeSetupCli);
});

interface ClaudeSettings {
  hooks: {
    PreCompact: Array<{ hooks: Array<{ command: string }>; matcher: string }>;
    Stop: Array<{ hooks: Array<{ command: string }>; matcher: string }>;
    UserPromptSubmit: Array<{ hooks: Array<{ command: string }>; matcher: string }>;
  };
}

function expectGeneratedPiExtension(extension: string) {
  expect(extension).toContain('lasso-status');
  expect(extension).toContain('serializeConversation(convertToLlm(messages))');
  expect(extension).toContain("runLasso(['lint', 'scan', '--force'], { input: conversation })");
  expect(extension).toContain('persistMemoryObservation(ctx, conversation, estimatedTokens)');
  expect(extension).toContain(
    "runLasso(['memory', 'observe', '--force', '--tokens', String(tokens)], { input: text })",
  );
  expect(extension).toContain("pi.on('before_agent_start', async (event, ctx) => {");
  expect(extension).toContain("runLasso(['memory', 'context', '--query', query])");
  expect(extension).toContain('=== LASSO MEMORY ===');
  expect(extension).toContain("pi.on('session_before_compact', async (event, ctx) => {");
  expect(extension).toContain(
    'runPiMemoryModel(ctx, buildMemoryReflectorPrompt(event), event.signal)',
  );
  expect(extension).toContain("runLasso(['memory', 'reflect'], { input: summary.trim() })");
  expect(extension).toContain('messagesToSummarize');
  expect(extension).toContain('turnPrefixMessages');
  expect(extension).toContain("pi.registerCommand('lasso:lint:scan'");
  expect(extension).toContain("pi.registerCommand('lasso:memory:status'");
  expect(extension).toContain("pi.on('turn_end', (_event, ctx) => {");
  expect(extension).not.toContain("pi.on('turn_end', async");
}

function expectSetupOutput(stdout: string, harness: 'claude' | 'opencode' | 'pi' = 'pi') {
  expect(stdout).toContain('lasso is ready.');
  expect(stdout).toContain('Created:');
  expect(stdout).toContain('Enabled observers:');
  expect(stdout).toContain('lint (detects recurring corrections');
  if (harness === 'opencode') {
    expect(stdout).toContain('Restart opencode');
    return;
  }
  if (harness === 'claude') {
    expect(stdout).toContain('Restart Claude Code');
    return;
  }
  expect(stdout).toContain('Restart Pi or run /reload, then try /lasso status');
}

async function testClaudeSetupCli() {
  const cwd = path.join(projectRoot, 'tests', '.tmp_init_cli_claude');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const setup = await runLasso(cwd, ['setup', '--harness', 'claude']);
  const hookFile = await Bun.file(path.join(cwd, '.claude', 'hooks', 'lasso-hooks.ts')).text();
  const settings = (await Bun.file(
    path.join(cwd, '.claude', 'settings.json'),
  ).json()) as ClaudeSettings;

  expectSetupOutput(setup.stdout, 'claude');
  expect(hookFile).toContain('handleUserPromptSubmit');
  expect(hookFile).toContain('handleStop');
  expect(hookFile).toContain('handlePreCompact');
  expect(hookFile).toContain('should-observe');
  expect(hookFile).toContain('should-reflect');
  expect(hookFile).toContain('additionalContext');
  expect(settings.hooks.UserPromptSubmit[0]!.matcher).toBe('*');
  expect(settings.hooks.Stop[0]!.matcher).toBe('*');
  expect(settings.hooks.PreCompact[0]!.matcher).toBe('*');
  expect(settings.hooks.UserPromptSubmit[0]!.hooks[0]!.command).toContain('lasso-hooks.ts');
  expect(settings.hooks.Stop[0]!.hooks[0]!.command).toContain('lasso-hooks.ts');
  expect(settings.hooks.PreCompact[0]!.hooks[0]!.command).toContain('lasso-hooks.ts');

  await rm(cwd, { force: true, recursive: true });
}

async function testOpencodeSetupCli() {
  const cwd = path.join(projectRoot, 'tests', '.tmp_init_cli_opencode');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const setup = await runLasso(cwd, ['setup', '--harness', 'opencode']);
  const plugin = await Bun.file(path.join(cwd, '.opencode', 'plugins', 'lasso.ts')).text();

  expectSetupOutput(setup.stdout, 'opencode');
  expect(plugin).toContain('LassoPlugin');
  expect(plugin).toContain("'chat.message'");
  expect(plugin).toContain("'experimental.chat.system.transform'");
  expect(plugin).toContain("'experimental.session.compacting'");
  expect(plugin).toContain("'event'");
  expect(plugin).toContain('should-observe');
  expect(plugin).toContain('should-reflect');

  await rm(cwd, { force: true, recursive: true });
}

async function testPiSetupCli() {
  const cwd = path.join(projectRoot, 'tests', '.tmp_init_cli');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const setup = await runLasso(cwd, [
    'setup',
    '--harness',
    'pi',
    '--detector-command',
    'lasso-detector',
  ]);
  const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();
  const extension = await Bun.file(path.join(cwd, '.pi', 'extensions', 'lasso.ts')).text();
  const status = await runLasso(cwd, ['status']);

  expectSetupOutput(setup.stdout);
  expect(config.harness.type).toBe('pi');
  expect(config.observers.lint.detectorCommand).toBe('lasso-detector');
  expectGeneratedPiExtension(extension);
  expect(status.stdout).toContain('Lint Observer Status');
  expect(status.stdout).toContain('Memory Observer Status');

  await rm(cwd, { force: true, recursive: true });
}
