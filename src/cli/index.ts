import { Database } from 'bun:sqlite';
import { Command } from 'commander';

import packageJson from '../../package.json';
import { loadConfig, setObserverEnabled } from '../config/load.ts';
import { getDb } from '../db/index.ts';
import { runMigrations } from '../db/migrations.ts';
import {
  handleLintExport,
  handleLintList,
  handleLintScan,
  handleLintShow,
  handleLintStatus,
  handleLintTransition,
} from '../observers/lint/commands.ts';
import {
  handleMemoryExport,
  handleMemoryObserve,
  handleMemoryReflect,
  handleMemoryStatus,
} from '../observers/memory/commands.ts';
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
  registerLintCommands(program, db, config);
  registerMemoryCommands(program, db, config);

  program.parse();
}

function describeConfiguredObservers(value = 'lint,memory') {
  return value
    .split(',')
    .map((observer) => observer.trim())
    .filter(
      (observer): observer is 'lint' | 'memory' => observer === 'lint' || observer === 'memory',
    )
    .map((observer) => describeObserver(observer))
    .join(', ');
}

function handleGlobalStatus(db: Database, config: Awaited<ReturnType<typeof loadConfig>>) {
  handleLintStatus(db, config);
  console.log('');
  handleMemoryStatus(db);
}

async function handleSetup(opts: {
  detectorCommand?: string;
  force?: boolean;
  harness?: 'pi';
  observers?: string;
}) {
  const { projectRoot } = resolveLassoPaths();
  const result = await initProject(projectRoot, opts);
  console.log('Set up lasso project.');
  console.log(`Harness: ${opts.harness ?? 'pi'} (Pi coding agent integration)`);
  console.log(`Observers: ${describeConfiguredObservers(opts.observers)}`);
  for (const file of result.created) console.log(`Created: ${file}`);
  for (const file of result.skipped) console.log(`Skipped existing: ${file}`);
  console.log('\nNext steps:');
  console.log('- Run: lasso status');
  console.log('- Run: lasso tui');
  if ((opts.harness ?? 'pi') === 'pi') console.log('- In Pi, run: /reload');
}

function registerGlobalCommands(
  program: Command,
  db: Database,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  program
    .command('config')
    .description('Show current project configuration')
    .action(() => {
      console.log(JSON.stringify(config, null, 2));
    });

  program
    .command('setup')
    .description('Set up lasso for a project and harness')
    .option(
      '--detector-command <command>',
      'Lint detector command (analyzes conversation history and emits lint JSON)',
    )
    .option('--force', 'Overwrite existing lasso files')
    .option('--harness <harness>', 'Harness adapter to install (pi)', 'pi')
    .option(
      '--observers <observers>',
      'Observers to enable: lint,memory (lint detects recurring corrections; memory stores useful context)',
      'lint,memory',
    )
    .action((opts) => handleSetup(opts));

  registerStatusAndTuiCommands(program, db, config);
  registerObserverToggleCommands(program);
}

function registerLintCommands(
  program: Command,
  db: Database,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  const lintCmd = program.command('lint').description('Lint observer commands');
  lintCmd
    .command('scan')
    .description('Force a detector run for the lint observer')
    .option('--input <path>', 'Conversation transcript file')
    .option('--detector-output <path>', 'Detector JSON output file')
    .option(
      '--detector-command <command>',
      'Command that reads prompt from stdin and writes detector JSON',
    )
    .option('--print-prompt', 'Print the detector prompt instead of applying results')
    .action((opts) => handleLintScan(db, opts, config));
  lintCmd
    .command('list')
    .description('List lint entries')
    .option('--status <status>', 'Filter by status')
    .action((opts) => handleLintList(db, opts));
  lintCmd
    .command('show <id>')
    .description('Show full entry detail')
    .action((id) => handleLintShow(db, id));
  registerLintTransitionCommands(lintCmd, db);
  lintCmd
    .command('status')
    .description('Counts by state, throttle state, last scan time')
    .action(() => handleLintStatus(db, config));
  lintCmd
    .command('export')
    .description('Export entries to stdout')
    .option('--format <format>', 'Export format', 'markdown')
    .action((opts) => handleLintExport(db, opts));
}

function registerLintTransitionCommands(lintCmd: Command, db: Database) {
  lintCmd
    .command('accept <id>')
    .description('Transition to accepted')
    .action((id) => handleLintTransition(db, id, 'accepted'));
  lintCmd
    .command('reject <id>')
    .description('Transition to rejected')
    .action((id) => handleLintTransition(db, id, 'rejected'));
  lintCmd
    .command('defer <id>')
    .description('Transition to deferred')
    .action((id) => handleLintTransition(db, id, 'deferred'));
  lintCmd
    .command('implement <id>')
    .description('Mark as implemented')
    .action((id) => handleLintTransition(db, id, 'implemented'));
}

function registerMemoryCommands(
  program: Command,
  db: Database,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  const memoryCmd = program.command('memory').description('Memory observer commands');
  memoryCmd
    .command('status')
    .description('Show current memory state')
    .action(() => handleMemoryStatus(db));
  memoryCmd
    .command('observe')
    .description('Record a memory observation snapshot')
    .option('--content <text>', 'Observation content')
    .option('--input <path>', 'Observation content file')
    .option('--scope <scope>', 'Memory scope: thread or resource')
    .action((opts) => handleMemoryObserve(db, opts, config));
  memoryCmd
    .command('reflect')
    .description('Record a consolidated memory reflection')
    .option('--content <text>', 'Reflection content')
    .option('--input <path>', 'Reflection content file')
    .option('--limit <count>', 'Number of recent snapshots to mark as sources', '20')
    .option('--emit-content', 'Print reflected content for harness compaction')
    .action((opts) => handleMemoryReflect(db, opts));
  memoryCmd
    .command('export')
    .description('Export memory snapshots and reflections to markdown')
    .action(() => handleMemoryExport(db));
}

function registerObserverToggleCommands(program: Command) {
  program
    .command('enable <observer>')
    .description('Enable an observer for the current project')
    .action(async (observer) => {
      await updateObserverEnabled(observer, true);
    });

  program
    .command('disable <observer>')
    .description('Disable an observer for the current project')
    .action(async (observer) => {
      await updateObserverEnabled(observer, false);
    });
}

function registerStatusAndTuiCommands(
  program: Command,
  db: Database,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  program
    .command('status')
    .description('Show combined lasso observer status')
    .action(() => handleGlobalStatus(db, config));

  program
    .command('tui')
    .description('Open the lasso terminal dashboard')
    .option('--once', 'Render one dashboard frame and exit')
    .action((opts) => handleTui(db, config, opts));
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
