import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { describeObserver, initProject } from '../src/onboarding/init.ts';

describe('project setup', () => {
  test('creates lasso config and does not overwrite without force', testPiSetup);
  test('creates opencode plugin for opencode harness', testOpencodeSetup);
  test('creates Claude Code hooks and settings for claude harness', testClaudeSetup);
});

interface ClaudeSettings {
  hooks: {
    PreCompact: Array<{ hooks: Array<{ command: string }> }>;
    Stop: Array<{ hooks: Array<{ command: string }> }>;
    UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }>;
  };
}

function assertClaudeHookLifecycle(hookFile: string) {
  expect(hookFile).toContain('handleUserPromptSubmit');
  expect(hookFile).toContain('handleStop');
  expect(hookFile).toContain('handlePreCompact');
  expect(hookFile).toContain('should-observe');
  expect(hookFile).toContain('should-reflect');
  expect(hookFile).toContain("['lint', 'scan', '--force']");
  expect(hookFile).toContain("['memory', 'observe', '--force'");
  expect(hookFile).toContain("['memory', 'context'");
  expect(hookFile).toContain("['memory', 'reflect']");
}

function assertClaudeSettings(settings: ClaudeSettings) {
  const commands = [
    settings.hooks.UserPromptSubmit[0]!.hooks[0]!.command,
    settings.hooks.Stop[0]!.hooks[0]!.command,
    settings.hooks.PreCompact[0]!.hooks[0]!.command,
  ];
  // All three point to the same script, differentiated by arg
  for (const cmd of commands) {
    expect(cmd).toContain('lasso-hooks.ts');
  }
  expect(settings.hooks.UserPromptSubmit[0]!.hooks[0]!.command).toContain('user-prompt-submit');
  expect(settings.hooks.Stop[0]!.hooks[0]!.command).toContain('stop');
  expect(settings.hooks.PreCompact[0]!.hooks[0]!.command).toContain('pre-compact');
}

function assertOpencodePluginLifecycle(plugin: string) {
  expect(plugin).toContain("'experimental.chat.system.transform'");
  expect(plugin).toContain("'experimental.session.compacting'");
  expect(plugin).toContain("'chat.message'");
  expect(plugin).toContain("'event'");
  expect(plugin).toContain("['memory', 'context', '--limit', '10']");
  expect(plugin).toContain("['memory', 'should-observe'");
  expect(plugin).toContain("['memory', 'should-reflect']");
  expect(plugin).toContain("['lint', 'scan', '--force']");
  expect(plugin).toContain("['memory', 'observe', '--force'");
}

async function testClaudeSetup() {
  const cwd = path.join(process.cwd(), 'tests', '.tmp_init_claude');
  await rm(cwd, { force: true, recursive: true });
  await mkdir(cwd, { recursive: true });

  const result = await initProject(cwd, { harness: 'claude' });
  const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();
  const hookFile = await Bun.file(path.join(cwd, '.claude', 'hooks', 'lasso-hooks.ts')).text();
  const settings = (await Bun.file(
    path.join(cwd, '.claude', 'settings.json'),
  ).json()) as ClaudeSettings;

  expect(result.created).toContain(path.join(cwd, '.claude', 'hooks', 'lasso-hooks.ts'));
  expect(result.created).toContain(path.join(cwd, '.claude', 'settings.json'));
  expect(config.harness.type).toBe('claude');
  assertClaudeHookLifecycle(hookFile);
  assertClaudeSettings(settings);

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
  assertOpencodePluginLifecycle(plugin);

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
