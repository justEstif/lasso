import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { describeObserver, initProject } from '../src/onboarding/init.ts';

describe('project setup', () => {
  test('creates lasso config and does not overwrite without force', async () => {
    const cwd = path.join(process.cwd(), 'tests', '.tmp_init_unit');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });

    const first = await initProject(cwd, { detectorCommand: 'detector', harness: 'pi' });
    const second = await initProject(cwd, { detectorCommand: 'changed', harness: 'pi' });
    const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();

    expect(first.created).toHaveLength(3);
    expect(second.skipped).toHaveLength(2);
    const extension = await Bun.file(path.join(cwd, '.pi', 'extensions', 'lasso.ts')).text();

    expect(await Bun.file(path.join(cwd, '.gitignore')).text()).toContain('.lasso/db.sqlite*');
    expect(extension).toContain("runLasso(['memory', 'reflect'], { input: conversation })");
    expect(extension).not.toContain('runMirroredCommand(`memory:reflect ${args}`');
    expect(config.harness.type).toBe('pi');
    expect(config.observers.lint.detectorCommand).toBe('detector');
    expect(describeObserver('lint')).toBe(
      'lint (detects recurring corrections and proposes lint rules)',
    );

    await rm(cwd, { force: true, recursive: true });
  });
});
