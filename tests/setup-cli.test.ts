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

    const setup = await runLasso(cwd, ['setup', '--pi', '--detector-command', 'lasso-detector']);
    const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();
    const extension = await Bun.file(path.join(cwd, '.pi', 'extensions', 'lasso.ts')).text();
    const status = await runLasso(cwd, ['status']);

    expect(setup.exitCode).toBe(0);
    expect(setup.stdout).toContain('Set up lasso project');
    expect(setup.stdout).toContain('Harness: pi (Pi coding agent integration)');
    expect(setup.stdout).toContain('lint (detects recurring corrections');
    expect(config.harness.type).toBe('pi');
    expect(config.observers.lint.detectorCommand).toBe('lasso-detector');
    expect(extension).toContain('lasso-status');
    expect(status.stdout).toContain('Lint Observer Status');
    expect(status.stdout).toContain('Memory Observer Status');

    await rm(cwd, { force: true, recursive: true });
  });
});
