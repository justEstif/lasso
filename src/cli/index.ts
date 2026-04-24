import { Command } from 'commander';

import packageJson from '../../package.json';
import { loadConfig } from '../config/load.ts';
import { getDb } from '../db/index.ts';
import { runMigrations } from '../db/migrations.ts';

export async function bootstrap() {
  const program = new Command();
  
  const db = getDb();
  runMigrations(db);

  program
    .name('lasso')
    .description('A harness-agnostic CLI for agent observational memory and linting')
    .version(packageJson.version);

  registerGlobalCommands(program);
  registerLintCommands(program);
  registerMemoryCommands(program);

  program.parse();
}

function registerGlobalCommands(program: Command) {
  program
    .command('config')
    .description('Show current project configuration')
    .action(async () => {
      const config = await loadConfig();
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

function registerLintCommands(program: Command) {
  const lintCmd = program.command('lint').description('Lint observer commands');
  lintCmd.command('scan').description('Force a detector run for the lint observer').action(() => console.log('Lint scan'));
  lintCmd.command('list').description('List lint entries').option('--status <status>', 'Filter by status').action((opts) => console.log('Lint list', opts));
  lintCmd.command('show <id>').description('Show full entry detail').action((id) => console.log(`Lint show ${id}`));
  lintCmd.command('status').description('Counts by state, throttle state, last scan time').action(() => console.log('Lint status'));
}

function registerMemoryCommands(program: Command) {
  const memoryCmd = program.command('memory').description('Memory observer commands');
  memoryCmd.command('status').description('Show current memory state').action(() => console.log('Memory status'));
  memoryCmd.command('observe').description('Force an observation run').action(() => console.log('Memory observe'));
  memoryCmd.command('reflect').description('Force a reflection run').action(() => console.log('Memory reflect'));
}
