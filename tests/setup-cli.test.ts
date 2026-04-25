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
  test('setup creates config and optional Pi extension', async () => {
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
  });
});

function expectGeneratedPiExtension(extension: string) {
  expect(extension).toContain('lasso-status');
  expect(extension).toContain('serializeConversation(convertToLlm(messages))');
  expect(extension).toContain("runLasso(['lint', 'scan'], { input: conversation })");
  expect(extension).toContain('persistMemoryObservation(ctx, conversation, estimatedTokens)');
  expect(extension).toContain("runLasso(['memory', 'observe', '--tokens', String(tokens)], { input: text })");
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

function expectSetupOutput(stdout: string) {
  expect(stdout).toContain('lasso is ready.');
  expect(stdout).toContain('Created:');
  expect(stdout).toContain('Enabled observers:');
  expect(stdout).toContain('lint (detects recurring corrections');
  expect(stdout).toContain('Restart Pi or run /reload, then try /lasso status');
}
