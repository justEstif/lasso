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

describe('tui CLI integration', () => {
  test('tui --once renders dashboard and exits', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_tui_cli');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });

    const result = await runLasso(cwd, ['tui', '--once']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('lint observer');
    expect(result.stdout).toContain('memory observer');

    await rm(cwd, { force: true, recursive: true });
  });
});
