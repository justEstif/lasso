import type { HarnessHostCapabilities } from '../contract.ts';

export const opencodeHostCapabilities = {
  compactionHooks: true,
  footerStatus: false,
  promptInjection: true,
  slashCommands: true,
} satisfies HarnessHostCapabilities;

export type OpencodeLassoCommand =
  | 'lint-scan'
  | 'lint-status'
  | 'memory-context'
  | 'memory-observe'
  | 'memory-reflect'
  | 'memory-should-observe'
  | 'memory-should-reflect'
  | 'memory-status'
  | 'memory-working';

export function buildOpencodeLassoArgs(command: OpencodeLassoCommand) {
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
  } satisfies Record<OpencodeLassoCommand, string[]>;

  return commands[command];
}
