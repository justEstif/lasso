import { Command } from 'commander';

import type { LassoDb } from '../db/index.ts';

import packageJson from '../../package.json';
import { loadConfig, setObserverEnabled } from '../config/load.ts';
import { getDb } from '../db/index.ts';
import { runMigrations } from '../db/migrations.ts';
import { registerLintCli } from '../observers/lint/cli.ts';
import { formatLintStatusText } from '../observers/lint/commands.ts';
import { buildLintStatusModel } from '../observers/lint/status.ts';
import { registerMemoryCli } from '../observers/memory/cli.ts';
import { getMemoryStatusText } from '../observers/memory/commands.ts';
import { describeObserver, initProject } from '../onboarding/init.ts';
import { resolveLassoPaths } from '../project/paths.ts';
import { handleTui } from '../tui/dashboard.tsx';

export async function bootstrap() {
  const program = new Command();

  const db = getDb();
  runMigrations(db);

  program
    .name('lasso')
    .description('A harness-agnostic CLI for agent observational memory and linting')
    .version(packageJson.version);

  const config = await loadConfig();

  registerGlobalCommands(program, db, config);
  registerLintCli(program, db, config);
  registerMemoryCli(program, db, config);

  program.parse();
}

function describeConfiguredObservers(value = 'lint,memory') {
  return value
    .split(',')
    .map((observer) => observer.trim())
    .filter(
      (observer): observer is 'lint' | 'memory' => observer === 'lint' || observer === 'memory',
    );
}

function handleDoctor(config: Awaited<ReturnType<typeof loadConfig>>) {
  const { lassoDir } = resolveLassoPaths();
  console.log('lasso doctor');
  console.log(`- Config: ${config ? 'ok' : 'missing'}`);
  console.log(`- Database: ok`);
  console.log(`- Lasso path: ${lassoDir}`);
  console.log(`- Harness: ${config.harness.type}`);
  console.log('- Pi extension: run setup if .pi/extensions/lasso.ts is missing');
}

function handleGlobalStatus(db: LassoDb, config: Awaited<ReturnType<typeof loadConfig>>) {
  console.log(formatLintStatusText(buildLintStatusModel(db, config)));
  console.log('');
  console.log(getMemoryStatusText(db));
}

async function handleSetup(opts: {
  detectorCommand?: string;
  force?: boolean;
  harness?: 'pi';
  observers?: string;
  yes?: boolean;
}) {
  const { projectRoot } = resolveLassoPaths();
  const result = await initProject(projectRoot, opts);
  printSetupSummary(opts, result);
}

function printEnabledObservers(observers?: string) {
  console.log('\nEnabled observers:');
  for (const observer of describeConfiguredObservers(observers)) {
    console.log(`  ${describeObserver(observer)}`);
  }
}

function printSetupSection(title: string, files: string[]) {
  if (files.length === 0) return;
  console.log(`\n${title}:`);
  for (const file of files) console.log(`  ${file}`);
}

function printSetupSummary(
  opts: { harness?: 'pi'; observers?: string },
  result: Awaited<ReturnType<typeof initProject>>,
) {
  console.log('lasso is ready.');
  printSetupSection('Created', result.created);
  printSetupSection('Skipped existing', result.skipped);
  printEnabledObservers(opts.observers);
  console.log('\nNext:');
  console.log(
    (opts.harness ?? 'pi') === 'pi'
      ? '  Restart Pi or run /reload, then try /lasso status'
      : '  Run lasso status',
  );
}

function registerGlobalCommands(
  program: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  registerSetupCommands(program, config);
  registerStatusAndTuiCommands(program, db, config);
  registerObserverToggleCommands(program);
}

function registerObserverToggleCommands(program: Command) {
  program.command('enable <observer>').description('Enable an observer').action(async (observer) => updateObserverEnabled(observer, true));
  program.command('disable <observer>').description('Disable an observer').action(async (observer) => updateObserverEnabled(observer, false));
}

function registerSetupCommands(program: Command, config: Awaited<ReturnType<typeof loadConfig>>) {
  program
    .command('config')
    .description('Show current project configuration')
    .action(() => console.log(JSON.stringify(config, null, 2)));

  program
    .command('setup')
    .description('Set up lasso for a project and harness')
    .option('--detector-command <command>', 'Lint detector command')
    .option('--advanced', 'Show advanced setup options in help output')
    .option('--force', 'Overwrite existing lasso files')
    .option('--harness <harness>', 'Harness adapter to install (pi)', 'pi')
    .option('--observers <observers>', 'Observers: lint,memory', 'lint,memory')
    .option('--yes', 'Use default setup choices without prompting')
    .action((opts) => handleSetup(opts));

  program.command('doctor').description('Check lasso project setup').action(() => handleDoctor(config));
}

function registerStatusAndTuiCommands(
  program: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  program.command('status').description('Show combined lasso observer status').action(() => handleGlobalStatus(db, config));
  program.command('tui').description('Open the lasso terminal dashboard').option('--once', 'Render one dashboard frame and exit').action((opts) => handleTui(db, config, opts));
}

async function updateObserverEnabled(observer: string, enabled: boolean) {
  try {
    await setObserverEnabled(observer, enabled);
    console.log(`${observer} observer ${enabled ? 'enabled' : 'disabled'}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
