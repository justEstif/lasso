import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export interface LassoConfig {
  observers: {
    lint: {
      debug: boolean;
      dedupWindowSize: number;
      detectorCommand?: string;
      detectorModel: string;
      enabled: boolean;
      scanThresholdTokens: number;
      scanThresholdTurns: number;
      staleAfterDays: number;
      throttleLimit: number;
    };
    memory: {
      debug: boolean;
      enabled: boolean;
      observationThreshold: number;
      observerModel: string;
      reflectionThreshold: number;
      reflectorModel: string;
      retryBackoffTurns: number;
      scope: 'resource' | 'thread';
    };
  };
}

const defaultConfig: LassoConfig = {
  observers: {
    lint: {
      debug: false,
      dedupWindowSize: 50,
      detectorCommand: undefined,
      detectorModel: 'anthropic/claude-sonnet-4-20250514',
      enabled: true,
      scanThresholdTokens: 5000,
      scanThresholdTurns: 10,
      staleAfterDays: 30,
      throttleLimit: 15,
    },
    memory: {
      debug: false,
      enabled: true,
      observationThreshold: 12_000,
      observerModel: 'anthropic/claude-sonnet-4-20250514',
      reflectionThreshold: 40_000,
      reflectorModel: 'anthropic/claude-sonnet-4-20250514',
      retryBackoffTurns: 2,
      scope: 'thread',
    },
  },
};

type ObserverName = keyof LassoConfig['observers'];

export async function loadConfig(cwd: string = process.cwd()): Promise<LassoConfig> {
  const globalPath = path.join(homedir(), '.config', 'lasso', 'config.json');
  const projectPath = path.join(cwd, '.lasso', 'config.json');

  const globalConfig = (await readJsonFile(globalPath)) || {};
  const projectConfig = (await readJsonFile(projectPath)) || {};

  // Deep merge strategy for MVP: override at observer level
  return {
    observers: {
      lint: {
        ...defaultConfig.observers.lint,
        ...globalConfig.observers?.lint,
        ...projectConfig.observers?.lint,
      },
      memory: {
        ...defaultConfig.observers.memory,
        ...globalConfig.observers?.memory,
        ...projectConfig.observers?.memory,
      },
    },
  };
}

export async function setObserverEnabled(
  observer: string,
  enabled: boolean,
  cwd: string = process.cwd(),
) {
  assertObserverName(observer);

  const projectPath = path.join(cwd, '.lasso', 'config.json');
  const projectConfig = (await readJsonFile(projectPath)) || {};
  const currentObservers = asRecord(projectConfig.observers);
  const currentObserverConfig = asRecord(currentObservers[observer]);

  const nextConfig = {
    ...projectConfig,
    observers: {
      ...currentObservers,
      [observer]: {
        ...currentObserverConfig,
        enabled,
      },
    },
  };

  await mkdir(path.dirname(projectPath), { recursive: true });
  await Bun.write(projectPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function assertObserverName(observer: string): asserts observer is ObserverName {
  if (observer === 'lint' || observer === 'memory') return;
  throw new Error(`Unknown observer: ${observer}. Expected one of: lint, memory.`);
}

async function readJsonFile(filePath: string): Promise<null | Record<string, unknown>> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  try {
    return (await file.json()) as Record<string, unknown>;
  } catch (error) {
    console.error(`Error parsing config file at ${filePath}:`, error);
    return null;
  }
}
