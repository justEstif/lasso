import { describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { resolveLassoPaths } from '../src/project/paths';

const tmpDir = path.join(process.cwd(), 'tests', '.tmp_paths');

describe('lasso path resolution', () => {
  test('walks upward to find project lasso config', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    const projectRoot = path.join(tmpDir, 'project');
    const nested = path.join(projectRoot, 'src', 'nested');
    await mkdir(path.join(projectRoot, '.lasso'), { recursive: true });
    await mkdir(nested, { recursive: true });
    await Bun.write(path.join(projectRoot, '.lasso', 'config.json'), '{}');

    const paths = resolveLassoPaths(nested, {});

    expect(paths.projectRoot).toBe(projectRoot);
    expect(paths.lassoDir).toBe(path.join(projectRoot, '.lasso'));

    await rm(tmpDir, { force: true, recursive: true });
  });

  test('uses LASSO_PATH as a project root override', async () => {
    const projectRoot = path.join(tmpDir, 'env-project');
    const cwd = path.join(tmpDir, 'other');

    const paths = resolveLassoPaths(cwd, { LASSO_PATH: projectRoot });

    expect(paths.projectRoot).toBe(projectRoot);
    expect(paths.lassoDir).toBe(path.join(projectRoot, '.lasso'));
  });

  test('accepts LASSO_PATH pointing directly at a .lasso directory', async () => {
    const lassoDir = path.join(tmpDir, 'direct', '.lasso');
    const cwd = path.join(tmpDir, 'other');

    const paths = resolveLassoPaths(cwd, { LASSO_PATH: lassoDir });

    expect(paths.projectRoot).toBe(path.dirname(lassoDir));
    expect(paths.lassoDir).toBe(lassoDir);
  });
});
