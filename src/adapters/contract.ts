export interface HarnessAdapterContract {
  readonly hostCapabilities: HarnessHostCapabilities;
  mirrorCommand(command: string): string[];
  observeTurn(conversation: string): Promise<void> | void;
  refreshStatus(): Promise<void> | void;
}

export interface HarnessConversationInput {
  readonly content: string;
  readonly source: 'full-session' | 'recent' | 'unobserved';
}

export interface HarnessHostCapabilities {
  readonly compactionHooks: boolean;
  readonly footerStatus: boolean;
  readonly promptInjection: boolean;
  readonly slashCommands: boolean;
}

export interface HarnessStatusSummary {
  readonly lintPending: number | undefined;
  readonly memorySnapshots: number | undefined;
}
