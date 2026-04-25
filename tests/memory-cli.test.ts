import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const entrypoint = path.join(projectRoot, 'index.ts');

async function runLasso(cwd: string, args: string[], input?: string) {
  const process = Bun.spawn(['bun', 'run', entrypoint, ...args], {
    cwd,
    stderr: 'pipe',
    stdin: input ? 'pipe' : 'ignore',
    stdout: 'pipe',
  });

  if (input && process.stdin) {
    process.stdin.write(input);
    process.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  return { exitCode, stderr, stdout };
}

describe('memory CLI integration', () => {
  test('observe, reflect, status, and export persist memory records', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_memory_cli');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });

    const observe = await runLasso(cwd, [
      'memory',
      'observe',
      '--content',
      'User prefers direct Bun APIs for file writes.',
      '--scope',
      'resource',
    ]);
    const reflect = await runLasso(cwd, [
      'memory',
      'reflect',
      '--content',
      'Prefer Bun.file and Bun.write for file IO.',
    ]);
    const stdinReflect = await runLasso(
      cwd,
      ['memory', 'reflect'],
      'Compaction-ready memory summary.',
    );
    const status = await runLasso(cwd, ['memory', 'status']);
    const exported = await runLasso(cwd, ['memory', 'export']);

    expect(observe.stdout).toContain('Memory snapshot');
    expect(reflect.stdout).toContain('created from 1 snapshots');
    expect(status.stdout).toContain('- Snapshots: 1');
    expect(stdinReflect.stdout).toContain('created from 1 snapshots');
    expect(status.stdout).toContain('- Reflections: 2');
    expect(exported.stdout).toContain('Prefer Bun.file and Bun.write');
    expect(exported.stdout).toContain('User prefers direct Bun APIs');

    await rm(cwd, { force: true, recursive: true });
  });
});
