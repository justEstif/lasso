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

describe('global CLI integration', () => {
  test('enable and disable update project config', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_cli_config');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });

    const disable = await runLasso(cwd, ['disable', 'lint']);
    const enable = await runLasso(cwd, ['enable', 'lint']);
    const config = await runLasso(cwd, ['config']);

    expect(disable.stdout).toContain('lint observer disabled');
    expect(enable.stdout).toContain('lint observer enabled');
    expect(config.stdout).toContain('"enabled": true');

    await rm(cwd, { force: true, recursive: true });
  });
});

describe('lint CLI detector output integration', () => {
  test('scan persists detector output and list displays it', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_lint_cli');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });

    await Bun.write(path.join(cwd, 'conversation.txt'), 'User: stop using antd here');
    await Bun.write(path.join(cwd, 'detector.json'), detectorOutput());

    const scan = await runLasso(cwd, [
      'lint',
      'scan',
      '--input',
      'conversation.txt',
      '--detector-output',
      'detector.json',
      '--force',
    ]);
    const list = await runLasso(cwd, ['lint', 'list']);
    const shortId = extractShortId(list.stdout);
    const accept = await runLasso(cwd, ['lint', 'accept', shortId]);
    const invalidReject = await runLasso(cwd, ['lint', 'reject', shortId]);
    const show = await runLasso(cwd, ['lint', 'show', shortId]);
    const status = await runLasso(cwd, ['lint', 'status']);

    expectScanListAndStatus(scan, list, status);
    expect(accept.stdout).toContain('transitioned from proposed to accepted');
    expect(invalidReject.exitCode).toBe(1);
    expect(invalidReject.stderr).toContain('Cannot transition lint entry');
    expect(show.stdout).toContain('Status: accepted');

    await rm(cwd, { force: true, recursive: true });
  });
});

describe('lint CLI threshold integration', () => {
  test('scan skips detector output below token threshold until forced', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_lint_cli_threshold');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });
    await Bun.write(path.join(cwd, 'detector.json'), detectorOutput());

    const skipped = await runLasso(cwd, [
      'lint',
      'scan',
      '--detector-output',
      'detector.json',
      '--tokens',
      '10',
    ]);
    const forced = await runLasso(cwd, [
      'lint',
      'scan',
      '--detector-output',
      'detector.json',
      '--tokens',
      '10',
      '--force',
    ]);

    expect(skipped.stdout).toContain('"skipped":true');
    expect(forced.stdout).toContain('1 created');

    await rm(cwd, { force: true, recursive: true });
  });
});

describe('lint CLI stdin integration', () => {
  test('scan reads conversation from stdin by default', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_lint_cli_stdin');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });
    await Bun.write(path.join(cwd, 'detector.json'), detectorOutput());

    const scan = await runLasso(
      cwd,
      ['lint', 'scan', '--detector-output', 'detector.json', '--force'],
      'User: stop using antd here',
    );
    const list = await runLasso(cwd, ['lint', 'list']);

    expect(scan.exitCode).toBe(0);
    expect(scan.stdout).toContain('1 created');
    expect(list.stdout).toContain('Avoid antd imports in migrated pages');

    await rm(cwd, { force: true, recursive: true });
  });
});

describe('lint CLI detector command integration', () => {
  test('scan can invoke a detector command', async () => {
    const cwd = path.join(projectRoot, 'tests', '.tmp_lint_cli_runner');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });
    await Bun.write(path.join(cwd, 'emit-detector.js'), detectorCommandScript());

    const scan = await runLasso(cwd, [
      'lint',
      'scan',
      '--detector-command',
      'bun emit-detector.js',
      '--force',
    ]);
    const list = await runLasso(cwd, ['lint', 'list']);

    expect(scan.exitCode).toBe(0);
    expect(scan.stdout).toContain('1 created');
    expect(list.stdout).toContain('Prefer shadcn components');

    await rm(cwd, { force: true, recursive: true });
  });
});

function detectorCommandScript() {
  return `
process.stdin.resume();
process.stdin.on('end', () => {
  console.log(JSON.stringify({
    entries: [{
      description: 'Prefer shadcn components',
      matches_existing_id: null,
    }],
    found_opportunity: true,
    reasoning: 'User stated a convention.'
  }));
});
`;
}

function detectorOutput() {
  return JSON.stringify({
    entries: [
      {
        description: 'Avoid antd imports in migrated pages',
        matches_existing_id: null,
        proposed_form: 'no-restricted-imports antd',
        source_excerpt: 'User: stop using antd here',
      },
    ],
    found_opportunity: true,
    reasoning: 'User stated a convention.',
  });
}

function expectScanListAndStatus(
  scan: Awaited<ReturnType<typeof runLasso>>,
  list: Awaited<ReturnType<typeof runLasso>>,
  status: Awaited<ReturnType<typeof runLasso>>,
) {
  expect(scan.exitCode).toBe(0);
  expect(scan.stdout).toContain('1 created');
  expect(list.stdout).toContain('PROPOSED');
  expect(list.stdout).toContain('Avoid antd imports in migrated pages');
  expect(status.stdout).toContain('Throttle: 0/15 proposed');
  expect(status.stdout).toContain('Throttle active: no');
  expect(status.stdout).not.toContain('Last scan: never');
}

function extractShortId(output: string) {
  return output.split(']')[0]?.replace('[', '') ?? '';
}
