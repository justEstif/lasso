import { Command } from 'commander';

import type { loadConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';

import {
  handleLintExport,
  handleLintList,
  handleLintScan,
  handleLintShow,
  handleLintStatus,
  handleLintTransition,
} from './commands.ts';

export function registerLintCli(
  program: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  const lintCmd = program.command('lint').description('Lint observer commands');
  registerLintScanCommand(lintCmd, db, config);
  registerLintQueryCommands(lintCmd, db, config);
  registerTransitionCommands(lintCmd, db);
}

function registerLintQueryCommands(
  lintCmd: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  lintCmd.command('list').description('List lint entries').option('--status <status>', 'Filter by status').action((opts) => handleLintList(db, opts));
  lintCmd.command('show <id>').description('Show full entry detail').action((id) => handleLintShow(db, id));
  lintCmd.command('status').description('Counts by state, throttle state, last scan time').action(() => handleLintStatus(db, config));
  lintCmd.command('export').description('Export entries to stdout').option('--format <format>', 'Export format', 'markdown').action((opts) => handleLintExport(db, opts));
}

function registerLintScanCommand(
  lintCmd: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  lintCmd
    .command('scan')
    .description('Force a detector run for the lint observer')
    .option('--input <path>', 'Conversation transcript file')
    .option('--tokens <count>', 'Estimated token count of the observed conversation')
    .option('--turns <count>', 'Estimated turn count of the observed conversation')
    .option('--force', 'Run detector even when the scan threshold is not met')
    .option('--detector-output <path>', 'Detector JSON output file')
    .option('--detector-command <command>', 'Command that reads prompt from stdin and writes detector JSON')
    .option('--print-prompt', 'Print the detector prompt instead of applying results')
    .action((opts) => handleLintScan(db, opts, config));
}

function registerTransitionCommands(lintCmd: Command, db: LassoDb) {
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
