import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { describeObserver, initProject } from '../src/onboarding/init.ts';

describe('project setup', () => {
  test('creates lasso config and does not overwrite without force', testPiSetup);
  test('creates opencode plugin for opencode harness', testOpencodeSetup);
  test('creates Claude Code hook and settings for claude harness', testClaudeSetup);
});

async function testClaudeSetup() {
  const cwd = path.join(process.cwd(), 'tests', '.tmp_init_claude');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const result = await initProject(cwd, { harness: 'claude' });
  const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();
  const hook = await Bun.file(
    path.join(cwd, '.claude', 'hooks', 'lasso-user-prompt-submit.ts'),
  ).text();
  const settings = await Bun.file(path.join(cwd, '.claude', 'settings.json')).json();

  expect(result.created).toContain(
    path.join(cwd, '.claude', 'hooks', 'lasso-user-prompt-submit.ts'),
  );
  expect(result.created).toContain(path.join(cwd, '.claude', 'settings.json'));
  expect(config.harness.type).toBe('claude');
  expect(hook).toContain("hookEventName: 'UserPromptSubmit'");
  expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toContain(
    'lasso-user-prompt-submit.ts',
  );

  await rm(cwd, { force: true, recursive: true });
}

async function testOpencodeSetup() {
  const cwd = path.join(process.cwd(), 'tests', '.tmp_init_opencode');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const result = await initProject(cwd, { harness: 'opencode' });
  const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();
  const plugin = await Bun.file(path.join(cwd, '.opencode', 'plugins', 'lasso.ts')).text();

  expect(result.created).toContain(path.join(cwd, '.opencode', 'plugins', 'lasso.ts'));
  expect(config.harness.type).toBe('opencode');
  expect(plugin).toContain("'experimental.chat.system.transform'");
  expect(plugin).toContain("['memory', 'context', '--limit', '10']");

  await rm(cwd, { force: true, recursive: true });
}

async function testPiSetup() {
  const cwd = path.join(process.cwd(), 'tests', '.tmp_init_unit');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const first = await initProject(cwd, { detectorCommand: 'detector', harness: 'pi' });
  const second = await initProject(cwd, { detectorCommand: 'changed', harness: 'pi' });
  const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();
  const extension = await Bun.file(path.join(cwd, '.pi', 'extensions', 'lasso.ts')).text();

  expect(first.created).toHaveLength(3);
  expect(second.skipped).toHaveLength(2);
  expect(await Bun.file(path.join(cwd, '.gitignore')).text()).toContain('.lasso/db.sqlite*');
  expect(extension).toContain("runLasso(['memory', 'reflect'], { input: conversation })");
  expect(extension).not.toContain('runMirroredCommand(`memory:reflect ${args}`');
  expect(config.harness.type).toBe('pi');
  expect(config.observers.lint.detectorCommand).toBe('detector');
  expect(describeObserver('lint')).toBe(
    'lint (detects recurring corrections and proposes lint rules)',
  );

  await rm(cwd, { force: true, recursive: true });
}
