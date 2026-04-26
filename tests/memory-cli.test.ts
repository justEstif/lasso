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
  expect(results.observe.stdout).toContain('1 entries');
  expect(results.reflect.stdout).toContain('created from 1 snapshots');
  expect(results.status.stdout).toContain('- Snapshots: 1');
  expect(results.status.stdout).toContain('- Entries: 1');
  expect(results.stdinReflect.stdout).toContain('created from 1 snapshots');
  expect(results.status.stdout).toContain('- Reflections: 2');
  expect(results.exported.stdout).toContain('Prefer Bun.file and Bun.write');
  expect(results.exported.stdout).toContain('User prefers direct Bun APIs');
}

async function observeMemory(cwd: string, content: string, tokens?: string) {
  const args = ['memory', 'observe', '--content', content];
  if (tokens) args.push('--tokens', tokens);
  return runLasso(cwd, args);
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
  }, 30000);

  test('export renders entries from observations', async () => {
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

    // Both observations produce entries in the export
    expect(exported.stdout).toContain('migrating dotfiles to Nix');
    expect(exported.stdout).toContain('migrate dotfiles to Nix');

    await rm(cwd, { force: true, recursive: true });
  }, 30000);
});

describe('memory should-observe', () => {
  test('respects token budget threshold', async () => {
    const cwd = await prepareTempProject('.tmp_memory_should_observe');

    // Default threshold is 12,000 tokens — below threshold should exit 1 (skip)
    const below = await runLasso(cwd, ['memory', 'should-observe', '--tokens', '5000']);
    expect(below.exitCode).toBe(1);
    const belowJson = JSON.parse(below.stdout);
    expect(belowJson.needed).toBe(false);
    expect(belowJson.unobserved).toBe(5000);

    // At threshold should exit 0 (observe)
    const atThreshold = await runLasso(cwd, ['memory', 'should-observe', '--tokens', '12000']);
    expect(atThreshold.exitCode).toBe(0);
    const atJson = JSON.parse(atThreshold.stdout);
    expect(atJson.needed).toBe(true);

    // After observing, the unobserved count resets
    await observeMemory(
      cwd,
      'User prefers Bun APIs for all file operations.',
      // Pass a high token count to simulate a full conversation
      '12000',
    );

    // unobserved = currentTokens(5000) - lastObserved(12000) = negative, so not needed
    const afterObserve = await runLasso(cwd, ['memory', 'should-observe', '--tokens', '5000']);
    expect(afterObserve.exitCode).toBe(1);

    // But 25,000 tokens should exceed threshold (unobserved = 25000 - 12000 = 13000 > 12000)
    const exceedsThreshold = await runLasso(cwd, ['memory', 'should-observe', '--tokens', '25000']);
    expect(exceedsThreshold.exitCode).toBe(0);

    await rm(cwd, { force: true, recursive: true });
  }, 30000);
});

describe('memory should-reflect', () => {
  test('respects reflection token budget threshold', async () => {
    const cwd = await prepareTempProject('.tmp_memory_should_reflect');

    // Default reflectionThreshold is 40,000 — no observations yet, so not needed
    const initial = await runLasso(cwd, ['memory', 'should-reflect']);
    expect(initial.exitCode).toBe(1);
    const initialJson = JSON.parse(initial.stdout);
    expect(initialJson.needed).toBe(false);
    expect(initialJson.lastObserved).toBe(0);
    expect(initialJson.threshold).toBe(40_000);

    // Observe with 40,000 tokens — at threshold should trigger reflection
    await observeMemory(cwd, 'User prefers Bun APIs for all file operations.', '40000');

    const atThreshold = await runLasso(cwd, ['memory', 'should-reflect']);
    expect(atThreshold.exitCode).toBe(0);
    const atJson = JSON.parse(atThreshold.stdout);
    expect(atJson.needed).toBe(true);
    expect(atJson.lastObserved).toBe(40_000);

    // Below threshold — observe with fewer tokens
    await observeMemory(cwd, 'A minor observation.', '5000');

    const below = await runLasso(cwd, ['memory', 'should-reflect']);
    expect(below.exitCode).toBe(1);
    const belowJson = JSON.parse(below.stdout);
    expect(belowJson.needed).toBe(false);
    expect(belowJson.lastObserved).toBe(5000);

    await rm(cwd, { force: true, recursive: true });
  }, 30000);
});
