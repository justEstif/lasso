import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const entrypoint = path.join(projectRoot, 'index.ts');

async function runLasso(cwd: string, args: string[]) {
  const process = Bun.spawn(['bun', 'run', entrypoint, ...args], {
    cwd,
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  return { exitCode, stderr, stdout };
}

describe('setup CLI integration', () => {
  test('setup creates config and optional Pi extension', testPiSetupCli);
  test('setup creates opencode plugin with full lifecycle', testOpencodeSetupCli);
  test('setup creates Claude Code hooks with full lifecycle', testClaudeSetupCli);
});

function expectGeneratedPiExtension(extension: string) {
  expect(extension).toContain('lasso-status');
  expect(extension).toContain('serializeConversation(convertToLlm(messages))');
  expect(extension).toContain("runLasso(['lint', 'scan'], { input: conversation })");
  expect(extension).toContain('persistMemoryObservation(ctx, conversation, estimatedTokens)');
  expect(extension).toContain(
    "runLasso(['memory', 'observe', '--tokens', String(tokens)], { input: text })",
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
  const submitHook = await Bun.file(
    path.join(cwd, '.claude', 'hooks', 'lasso-user-prompt-submit.ts'),
  ).text();
  const stopHook = await Bun.file(path.join(cwd, '.claude', 'hooks', 'lasso-stop.ts')).text();
  const compactHook = await Bun.file(
    path.join(cwd, '.claude', 'hooks', 'lasso-pre-compact.ts'),
  ).text();
  const settings = await Bun.file(path.join(cwd, '.claude', 'settings.json')).json();

  expectSetupOutput(setup.stdout, 'claude');
  expect(submitHook).toContain('additionalContext');
  expect(stopHook).toContain('memory');
  expect(stopHook).toContain('observe');
  expect(stopHook).toContain('lint');
  expect(stopHook).toContain('scan');
  expect(compactHook).toContain('memory');
  expect(compactHook).toContain('reflect');
  expect(settings.hooks.UserPromptSubmit[0].matcher).toBe('*');
  expect(settings.hooks.Stop[0].matcher).toBe('*');
  expect(settings.hooks.PreCompact[0].matcher).toBe('*');

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
