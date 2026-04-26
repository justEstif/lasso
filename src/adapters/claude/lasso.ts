import type { HarnessHostCapabilities } from '../contract.ts';

export const claudeHostCapabilities = {
  compactionHooks: true,
  footerStatus: false,
  promptInjection: true,
  slashCommands: false,
} satisfies HarnessHostCapabilities;

export type ClaudeLassoCommand =
  | 'lint-scan'
  | 'lint-status'
  | 'memory-context'
  | 'memory-observe'
  | 'memory-reflect'
  | 'memory-should-observe'
  | 'memory-should-reflect'
  | 'memory-status'
  | 'memory-working';

export function buildClaudeLassoArgs(command: ClaudeLassoCommand) {
  const commands = {
    'lint-scan': ['lint', 'scan'],
    'lint-status': ['lint', 'status'],
    'memory-context': ['memory', 'context'],
    'memory-observe': ['memory', 'observe'],
    'memory-reflect': ['memory', 'reflect'],
    'memory-should-observe': ['memory', 'should-observe'],
    'memory-should-reflect': ['memory', 'should-reflect'],
    'memory-status': ['memory', 'status'],
    'memory-working': ['memory', 'working'],
  } satisfies Record<ClaudeLassoCommand, string[]>;

  return commands[command];
}
