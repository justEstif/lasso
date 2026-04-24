import { existsSync } from 'node:fs';
import path from 'node:path';

export interface LassoPaths {
  lassoDir: string;
  projectRoot: string;
}

export function resolveLassoPaths(cwd: string = process.cwd(), env = process.env): LassoPaths {
  const envPath = env.LASSO_PATH?.trim();
  if (envPath) return resolveFromEnvPath(envPath, cwd);

  const discoveredRoot = findProjectRoot(cwd);
  return pathsForProjectRoot(discoveredRoot ?? cwd);
}

function findProjectRoot(cwd: string): null | string {
  let current = path.resolve(cwd);

  while (true) {
    if (existsSync(path.join(current, '.lasso', 'config.json'))) return current;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function pathsForProjectRoot(projectRoot: string): LassoPaths {
  const resolvedRoot = path.resolve(projectRoot);
  return {
    lassoDir: path.join(resolvedRoot, '.lasso'),
    projectRoot: resolvedRoot,
  };
}

function resolveFromEnvPath(envPath: string, cwd: string): LassoPaths {
  const resolvedPath = path.resolve(cwd, envPath);

  if (path.basename(resolvedPath) === '.lasso') {
    return {
      lassoDir: resolvedPath,
      projectRoot: path.dirname(resolvedPath),
    };
  }

  return pathsForProjectRoot(resolvedPath);
}
