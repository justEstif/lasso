import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { defaultConfig } from '../config/load.ts';

export type HarnessSelection = 'claude' | 'opencode' | 'pi';

export interface InitOptions {
  advanced?: boolean;
  detectorCommand?: string;
  force?: boolean;
  harness?: HarnessSelection;
  observers?: string;
  yes?: boolean;
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

export type ObserverSelection = 'lint' | 'memory';

const claudeHookTemplatePath = new URL(
  'templates/claude-user-prompt-submit.ts.template',
  import.meta.url,
);
const claudePreCompactTemplatePath = new URL(
  'templates/claude-pre-compact.ts.template',
  import.meta.url,
);
const claudeStopTemplatePath = new URL('templates/claude-stop.ts.template', import.meta.url);
const opencodePluginTemplatePath = new URL(
  'templates/opencode-plugin.ts.template',
  import.meta.url,
);
const piExtensionTemplatePath = new URL('templates/pi-extension.ts.template', import.meta.url);

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
  if (shouldInstallOpencodeAdapter(options)) await writeOpencodePlugin(cwd, options, result);
  if (shouldInstallClaudeAdapter(options)) await writeClaudeHook(cwd, options, result);
  await writeGitignore(cwd, result);

  return result;
}

function buildClaudeSettings() {
  return {
    hooks: {
      PreCompact: [claudeHookEntry('lasso-pre-compact.ts')],
      Stop: [claudeHookEntry('lasso-stop.ts')],
      UserPromptSubmit: [claudeHookEntry('lasso-user-prompt-submit.ts')],
    },
  };
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

function claudeHookEntry(script: string) {
  return {
    hooks: [{ command: `bun "$CLAUDE_PROJECT_DIR"/.claude/hooks/${script}`, type: 'command' }],
    matcher: '*',
  };
}

async function claudeHookTemplate() {
  return Bun.file(claudeHookTemplatePath).text();
}

async function claudePreCompactTemplate() {
  return Bun.file(claudePreCompactTemplatePath).text();
}

async function claudeStopTemplate() {
  return Bun.file(claudeStopTemplatePath).text();
}

async function opencodePluginTemplate() {
  return Bun.file(opencodePluginTemplatePath).text();
}

function parseObservers(value = 'lint,memory'): ObserverSelection[] {
  const observers = value.split(',').map((observer) => observer.trim());
  const valid = observers.filter((observer): observer is ObserverSelection => {
    return observer === 'lint' || observer === 'memory';
  });

  if (valid.length !== observers.length) throw new Error('Observers must be lint,memory, or both.');
  return valid;
}

async function piExtensionTemplate() {
  return Bun.file(piExtensionTemplatePath).text();
}

function shouldInstallClaudeAdapter(options: InitOptions) {
  return options.harness === 'claude';
}

function shouldInstallOpencodeAdapter(options: InitOptions) {
  return options.harness === 'opencode';
}

function shouldInstallPiAdapter(options: InitOptions) {
  return (options.harness ?? 'pi') === 'pi';
}

async function writeClaudeHook(cwd: string, options: InitOptions, result: InitResult) {
  const hooksDir = path.join(cwd, '.claude', 'hooks');
  await writeClaudeHookFiles(hooksDir, options, result);
  await writeClaudeSettings(cwd, options, result);
}

async function writeClaudeHookFiles(hooksDir: string, options: InitOptions, result: InitResult) {
  await writeIfAllowed(
    path.join(hooksDir, 'lasso-user-prompt-submit.ts'),
    await claudeHookTemplate(),
    options,
    result,
  );
  await writeIfAllowed(
    path.join(hooksDir, 'lasso-stop.ts'),
    await claudeStopTemplate(),
    options,
    result,
  );
  await writeIfAllowed(
    path.join(hooksDir, 'lasso-pre-compact.ts'),
    await claudePreCompactTemplate(),
    options,
    result,
  );
}

async function writeClaudeSettings(cwd: string, options: InitOptions, result: InitResult) {
  const settingsPath = path.join(cwd, '.claude', 'settings.json');
  await writeIfAllowed(
    settingsPath,
    `${JSON.stringify(buildClaudeSettings(), null, 2)}\n`,
    options,
    result,
  );
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

async function writeGitignore(cwd: string, result: InitResult) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const entries = ['.lasso/db.sqlite*', '.lasso/debug/'];
  const existing = (await Bun.file(gitignorePath).exists())
    ? await Bun.file(gitignorePath).text()
    : '';
  const missing = entries.filter((entry) => !existing.split(/\r?\n/).includes(entry));
  if (missing.length === 0) return;

  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  await Bun.write(gitignorePath, `${existing}${prefix}${missing.join('\n')}\n`);
  result.created.push(gitignorePath);
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

async function writeOpencodePlugin(cwd: string, options: InitOptions, result: InitResult) {
  const pluginPath = path.join(cwd, '.opencode', 'plugins', 'lasso.ts');
  await writeIfAllowed(pluginPath, await opencodePluginTemplate(), options, result);
}

async function writePiExtension(cwd: string, options: InitOptions, result: InitResult) {
  const extensionPath = path.join(cwd, '.pi', 'extensions', 'lasso.ts');
  await writeIfAllowed(extensionPath, await piExtensionTemplate(), options, result);
}
