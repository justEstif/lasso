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
  handleMemoryContext,
  handleMemoryExport,
  handleMemoryObserve,
  handleMemoryReflect,
  handleMemoryShouldObserve,
  handleMemoryStatus,
  handleMemoryWorking,
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
    );
}

function handleDoctor(db: Database, config: Awaited<ReturnType<typeof loadConfig>>) {
  const { lassoDir } = resolveLassoPaths();
  console.log('lasso doctor');
  console.log(`- Config: ${config ? 'ok' : 'missing'}`);
  console.log(`- Database: ${db ? 'ok' : 'unavailable'}`);
  console.log(`- Lasso path: ${lassoDir}`);
  console.log(`- Harness: ${config.harness.type}`);
  console.log('- Pi extension: run setup if .pi/extensions/lasso.ts is missing');
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

async function readStdinContent(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  return Bun.stdin.text();
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
    .option('--advanced', 'Show advanced setup options in help output')
    .option('--force', 'Overwrite existing lasso files')
    .option('--harness <harness>', 'Harness adapter to install (pi)', 'pi')
    .option(
      '--observers <observers>',
      'Observers to enable: lint,memory (lint detects recurring corrections; memory stores useful context)',
      'lint,memory',
    )
    .option('--yes', 'Use default setup choices without prompting')
    .action((opts) => handleSetup(opts));

  program
    .command('doctor')
    .description('Check lasso project setup')
    .action(() => handleDoctor(db, config));

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
    .option('--tokens <count>', 'Estimated token count of the observed conversation')
    .action((opts) => handleMemoryObserve(db, opts, config));
  registerMemoryReflectAndContext(memoryCmd, db);
  registerMemoryObserveCheck(memoryCmd, db, config);
  registerMemoryWorkingCommand(memoryCmd, db);
  memoryCmd
    .command('export')
    .description('Export memory observations and reflections to markdown')
    .option('--priority <level>', 'Filter by priority: high, medium, low')
    .option('--after <date>', 'Show entries observed on or after date (YYYY-MM-DD)')
    .option('--before <date>', 'Show entries observed on or before date (YYYY-MM-DD)')
    .action((opts) => handleMemoryExport(db, opts));
}

function registerMemoryObserveCheck(
  memoryCmd: Command,
  db: Database,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  memoryCmd
    .command('should-observe')
    .description('Check if memory observation is needed based on token budget')
    .requiredOption('--tokens <count>', 'Current estimated token count of the conversation')
    .action((opts) => handleMemoryShouldObserve(db, Number(opts.tokens), config));
}

function registerMemoryReflectAndContext(memoryCmd: Command, db: Database) {
  memoryCmd
    .command('reflect')
    .description('Record a consolidated memory reflection')
    .option('--content <text>', 'Reflection content')
    .option('--input <path>', 'Reflection content file')
    .option('--limit <count>', 'Number of recent snapshots to mark as sources', '20')
    .action((opts) => handleMemoryReflect(db, opts));
  memoryCmd
    .command('context')
    .description('Show focused memory context, optionally ranked by query')
    .option('--query <text>', 'Query used to rank relevant memory')
    .option('--limit <count>', 'Maximum number of memory items', '10')
    .option('--priority <level>', 'Filter by priority: high, medium, low')
    .option('--after <date>', 'Show entries observed on or after date (YYYY-MM-DD)')
    .option('--before <date>', 'Show entries observed on or before date (YYYY-MM-DD)')
    .option(
      '--sort <field:order>',
      'Sort entries by field:order — field is observed_at|created_at|referenced_date, order is asc|desc',
    )
    .action((opts) => handleMemoryContext(db, opts));
}

function registerMemoryWorkingCommand(memoryCmd: Command, db: Database) {
  memoryCmd
    .command('working')
    .description('View or manage working memory scratchpad')
    .option('--init', 'Initialize working memory with a default template')
    .option('--edit', 'Update working memory content from stdin')
    .option('--reset', 'Reset working memory to the default template')
    .option('--resource-id <id>', 'Scope working memory to a specific resource')
    .option('--thread-id <id>', 'Scope working memory to a specific thread')
    .action(async (opts) => {
      const stdin = opts.edit ? await readStdinContent() : undefined;
      handleMemoryWorking(db, { ...opts, stdin });
    });
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
