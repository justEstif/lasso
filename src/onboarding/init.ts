import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { defaultConfig } from '../config/load.ts';

export interface InitOptions {
  detectorCommand?: string;
  force?: boolean;
  harness?: 'pi';
  observers?: string;
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

export type ObserverSelection = 'lint' | 'memory';

const piExtensionLines = [
  "import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';",
  '',
  'async function runLasso(args: string[]) {',
  "  const child = Bun.spawn(['lasso', ...args], {",
  '    cwd: process.cwd(),',
  "    stderr: 'pipe',",
  "    stdout: 'pipe',",
  '  });',
  '',
  '  const [stdout, stderr, exitCode] = await Promise.all([',
  '    new Response(child.stdout).text(),',
  '    new Response(child.stderr).text(),',
  '    child.exited,',
  '  ]);',
  '',
  '  return { exitCode, stderr, stdout };',
  '}',
  '',
  'export default function (pi: ExtensionAPI) {',
  "  pi.on('session_start', async (_event, ctx) => {",
  "    const result = await runLasso(['memory', 'status']);",
  "    if (result.exitCode === 0) ctx.ui.setStatus('lasso', 'lasso memory ready');",
  '  });',
  '',
  "  pi.on('turn_end', async (_event, ctx) => {",
  "    const result = await runLasso(['lint', 'status']);",
  "    const text = result.exitCode === 0 ? 'lasso lint checked' : 'lasso check failed';",
  "    ctx.ui.setStatus('lasso', text);",
  '  });',
  '',
  "  pi.registerCommand('lasso-status', {",
  "    description: 'Show lasso lint and memory status',",
  '    handler: async (_args, ctx) => {',
  "      const lint = await runLasso(['lint', 'status']);",
  "      const memory = await runLasso(['memory', 'status']);",
  "      const level = lint.exitCode || memory.exitCode ? 'error' : 'info';",
  '      ctx.ui.notify(`${lint.stdout}\\n${memory.stdout}`.trim(), level);',
  '    },',
  '  });',
  '}',
];

export function describeObserver(observer: ObserverSelection) {
  const descriptions = {
    lint: 'detects recurring corrections and proposes lint rules',
    memory: 'stores observations and reflections for future context',
  } satisfies Record<ObserverSelection, string>;

  return `${observer} (${descriptions[observer]})`;
}

export async function initProject(cwd: string, options: InitOptions): Promise<InitResult> {
  const result: InitResult = { created: [], skipped: [] };
  await mkdir(path.join(cwd, '.lasso'), { recursive: true });

  await writeConfig(cwd, options, result);
  if (shouldInstallPiAdapter(options)) await writePiExtension(cwd, options, result);

  return result;
}

function buildConfig(options: InitOptions) {
  const observers = parseObservers(options.observers);
  return {
    harness: {
      type: options.harness ?? 'pi',
    },
    observers: {
      lint: {
        ...defaultConfig.observers.lint,
        detectorCommand: options.detectorCommand ?? defaultConfig.observers.lint.detectorCommand,
        enabled: observers.includes('lint'),
      },
      memory: {
        ...defaultConfig.observers.memory,
        enabled: observers.includes('memory'),
      },
    },
  };
}

function parseObservers(value = 'lint,memory'): ObserverSelection[] {
  const observers = value.split(',').map((observer) => observer.trim());
  const valid = observers.filter((observer): observer is ObserverSelection => {
    return observer === 'lint' || observer === 'memory';
  });

  if (valid.length !== observers.length) throw new Error('Observers must be lint,memory, or both.');
  return valid;
}

function piExtensionTemplate() {
  return `${piExtensionLines.join('\n')}\n`;
}

function shouldInstallPiAdapter(options: InitOptions) {
  return (options.harness ?? 'pi') === 'pi';
}

async function writeConfig(cwd: string, options: InitOptions, result: InitResult) {
  const configPath = path.join(cwd, '.lasso', 'config.json');
  await writeIfAllowed(
    configPath,
    `${JSON.stringify(buildConfig(options), null, 2)}\n`,
    options,
    result,
  );
}

async function writeIfAllowed(
  filePath: string,
  content: string,
  options: InitOptions,
  result: InitResult,
) {
  if (!options.force && (await Bun.file(filePath).exists())) {
    result.skipped.push(filePath);
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await Bun.write(filePath, content);
  result.created.push(filePath);
}

async function writePiExtension(cwd: string, options: InitOptions, result: InitResult) {
  const extensionPath = path.join(cwd, '.pi', 'extensions', 'lasso.ts');
  await writeIfAllowed(extensionPath, piExtensionTemplate(), options, result);
}
