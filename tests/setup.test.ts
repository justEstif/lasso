import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { describeObserver, initProject } from '../src/onboarding/init.ts';

describe('project setup', () => {
  test('creates lasso config and does not overwrite without force', async () => {
    const cwd = path.join(process.cwd(), 'tests', '.tmp_init_unit');
    await rm(cwd, { force: true, recursive: true });
    await mkdir(cwd, { recursive: true });

    const first = await initProject(cwd, { detectorCommand: 'detector', pi: true });
    const second = await initProject(cwd, { detectorCommand: 'changed', pi: true });
    const config = await Bun.file(path.join(cwd, '.lasso', 'config.json')).json();

    expect(first.created).toHaveLength(2);
    expect(second.skipped).toHaveLength(2);
    expect(config.harness.type).toBe('pi');
    expect(config.observers.lint.detectorCommand).toBe('detector');
    expect(describeObserver('lint')).toBe(
      'lint (detects recurring corrections and proposes lint rules)',
    );

    await rm(cwd, { force: true, recursive: true });
  });
});
