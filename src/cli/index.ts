import { Database } from 'bun:sqlite';
import { Command } from 'commander';

import packageJson from '../../package.json';
import { loadConfig } from '../config/load.ts';
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

export async function bootstrap() {
  const program = new Command();

  const db = getDb();
  runMigrations(db);

  program
    .name('lasso')
    .description('A harness-agnostic CLI for agent observational memory and linting')
    .version(packageJson.version);

  const config = await loadConfig();

  registerGlobalCommands(program, config);
  registerLintCommands(program, db, config);
  registerMemoryCommands(program);

  program.parse();
}

function registerGlobalCommands(program: Command, config: Awaited<ReturnType<typeof loadConfig>>) {
  program
    .command('config')
    .description('Show current project configuration')
    .action(() => {
      console.log(JSON.stringify(config, null, 2));
    });

  program
    .command('enable <observer>')
    .description('Enable an observer for the current project')
    .action(async (observer) => {
      console.log(`Enabling observer: ${observer}`);
      /* Implement in lasso-x7vb */
    });

  program
    .command('disable <observer>')
    .description('Disable an observer for the current project')
    .action(async (observer) => {
      console.log(`Disabling observer: ${observer}`);
      /* Implement in lasso-x7vb */
    });
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

function registerMemoryCommands(program: Command) {
  const memoryCmd = program.command('memory').description('Memory observer commands');
  memoryCmd
    .command('status')
    .description('Show current memory state')
    .action(() => console.log('Memory status'));
  memoryCmd
    .command('observe')
    .description('Force an observation run')
    .action(() => console.log('Memory observe'));
  memoryCmd
    .command('reflect')
    .description('Force a reflection run')
    .action(() => console.log('Memory reflect'));
}
