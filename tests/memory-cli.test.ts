import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const entrypoint = path.join(projectRoot, 'index.ts');

function expectMemoryLifecycleOutput(results: {
  exported: { stdout: string };
  observe: { stdout: string };
  reflect: { stdout: string };
  status: { stdout: string };
  stdinReflect: { stdout: string };
}) {
  expect(results.observe.stdout).toContain('Memory snapshot');
  expect(results.reflect.stdout).toContain('created from 1 snapshots');
  expect(results.status.stdout).toContain('- Snapshots: 1');
  expect(results.stdinReflect.stdout).toContain('created from 1 snapshots');
  expect(results.status.stdout).toContain('- Reflections: 2');
  expect(results.exported.stdout).toContain('Prefer Bun.file and Bun.write');
  expect(results.exported.stdout).toContain('User prefers direct Bun APIs');
}

async function observeMemory(cwd: string, content: string) {
  return runLasso(cwd, ['memory', 'observe', '--content', content]);
}

async function prepareTempProject(name: string) {
  const cwd = path.join(projectRoot, 'tests', name);
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });
  return cwd;
}

async function reflectMemory(cwd: string, content: string) {
  return runLasso(cwd, ['memory', 'reflect', '--content', content]);
}

async function reflectMemoryFromStdin(cwd: string) {
  return runLasso(cwd, ['memory', 'reflect'], 'Compaction-ready memory summary.');
}

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
    const cwd = await prepareTempProject('.tmp_memory_cli');

    const observe = await observeMemory(cwd, 'User prefers direct Bun APIs for file writes.');
    const reflect = await reflectMemory(cwd, 'Prefer Bun.file and Bun.write for file IO.');
    const stdinReflect = await reflectMemoryFromStdin(cwd);
    const status = await runLasso(cwd, ['memory', 'status']);
    const exported = await runLasso(cwd, ['memory', 'export']);
    const context = await runLasso(cwd, ['memory', 'context', '--query', 'Bun file writes']);

    expect(context.stdout).toContain('User prefers direct Bun APIs');
    expectMemoryLifecycleOutput({ exported, observe, reflect, status, stdinReflect });

    await rm(cwd, { force: true, recursive: true });
  });

  test('export collapses near-duplicate snapshots', async () => {
    const cwd = await prepareTempProject('.tmp_memory_dedupe');

    await observeMemory(
      cwd,
      'User is migrating dotfiles to Nix with home-manager and nix-darwin. Keep mise for packages not in nix.',
    );
    await observeMemory(
      cwd,
      'User wants to migrate dotfiles to Nix using home-manager plus nix-darwin. Keep mise for packages not available in nix.',
    );

    const exported = await runLasso(cwd, ['memory', 'export']);
    const snapshotHeadings = exported.stdout.match(/^### .*\(thread\)$/gm) ?? [];

    expect(snapshotHeadings).toHaveLength(1);
    expect(exported.stdout).toContain('**Seen:** 2');

    await rm(cwd, { force: true, recursive: true });
  });
});
