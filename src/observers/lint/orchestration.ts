import type { LassoConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';
import type { ObserverLifecycleGates } from '../service.ts';
import type { LintRecurrence, LintStatus } from './db';
import type { LintEntry } from './db';
import type { ScanSummary } from './detector.ts';
import type { LintStatusModel } from './status.ts';

import { estimateTokens } from '../memory/tokens.ts';
import {
  checkSaturation,
  checkTokenBudget,
  checkTurnBudget,
  runObserverLifecycle,
} from '../service.ts';
import {
  getEntry,
  getLintObservationState,
  getRecurrences,
  listActiveEntries,
  listEntries,
  recordLintObservationProgress,
  recordScanRun,
  resolveEntryId,
  updateEntryStatus,
} from './db';
import { applyDetectorResult, parseDetectorResult } from './detector.ts';
import { buildLintDetectorPrompt } from './prompt.ts';
import { runDetector } from './runner.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LintListResult {
  entries: Array<{ description: string; id: string; status: LintStatus }>;
}

export interface LintScanGateInput {
  activeCount: number;
  config: LassoConfig;
  currentTokens: number;
  currentTurns: number;
  lastObservedTokens: number;
  lastObservedTurns: number;
}

export interface LintScanGateResult {
  saturation: ReturnType<typeof checkSaturation>;
  tokenBudget: ReturnType<typeof checkTokenBudget>;
  turnBudget: ReturnType<typeof checkTurnBudget>;
}

export interface LintScanInput {
  conversation: string;
  detectorCommand?: string;
  detectorOutput?: string;
  force?: boolean;
  printPrompt?: boolean;
  tokens?: number;
  turns?: number;
}

export type LintScanResult =
  | { gates: ObserverLifecycleGates; type: 'skipped' }
  | { prompt: string; type: 'prompt' }
  | { summary: ScanSummary; type: 'completed' };

export interface LintShowResult {
  entry: LintEntry;
  recurrences: LintRecurrence[];
}

export interface LintTransitionResult {
  from: LintStatus;
  id: string;
  to: LintStatus;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ComputeScanGatesInput {
  config: LassoConfig;
  db: LassoDb;
  input: LintScanInput;
  observedTokens: number;
  observedTurns: number;
}

// ---------------------------------------------------------------------------
// Pure orchestration
// ---------------------------------------------------------------------------

export function buildLintExportMarkdown(db: LassoDb, opts?: { format?: string }): string {
  if (opts?.format && opts.format !== 'markdown') {
    throw new Error('Only markdown export is supported in MVP.');
  }

  const entries = listEntries(db);
  if (entries.length === 0) return '# Lint Observer Export\n\nNo entries found.';

  const parts: string[] = ['# Lint Observer Export', ''];
  for (const entry of entries) {
    parts.push(...renderExportEntry(db, entry));
  }
  return parts.join('\n');
}

export function checkShouldScanLint(input: LintScanGateInput): LintScanGateResult {
  const lintConfig = input.config.observers.lint;

  return {
    saturation: checkSaturation({
      activeCount: input.activeCount,
      limit: lintConfig.throttleLimit,
    }),
    tokenBudget: checkTokenBudget({
      currentTokens: input.currentTokens,
      lastObservedTokens: input.lastObservedTokens,
      thresholdTokens: lintConfig.scanThresholdTokens,
    }),
    turnBudget: checkTurnBudget({
      currentTurns: input.currentTurns,
      lastObservedTurns: input.lastObservedTurns,
      thresholdTurns: lintConfig.scanThresholdTurns,
    }),
  };
}

export async function executeLintScan(
  db: LassoDb,
  input: LintScanInput,
  config: LassoConfig,
  detectorRunner?: (prompt: string, command?: string) => Promise<string>,
): Promise<LintScanResult> {
  const observedTokens = input.tokens ?? estimateTokens(input.conversation);
  const observedTurns = input.turns ?? estimateTurns(input.conversation);
  const gates = computeScanGates({ config, db, input, observedTokens, observedTurns });
  const prompt = buildLintDetectorPrompt(input.conversation, listActiveEntries(db, 50));

  if (input.printPrompt) return { prompt, type: 'prompt' };

  const observation = await runObserverLifecycle({
    force: input.force,
    gates,
    observe: async () =>
      applyLintDetector(db, await readDetectorOutput(prompt, input, config, detectorRunner)),
    persistProgress: buildScanPersistCallback(db, observedTurns),
  });

  return observation.skipped
    ? { gates: observation.gates, type: 'skipped' }
    : { summary: observation.result, type: 'completed' };
}

export function executeLintTransition(
  db: LassoDb,
  id: string,
  status: LintStatus,
): LintTransitionResult {
  const resolvedId = resolveEntryId(db, id);
  const entry = getEntry(db, resolvedId);
  if (!entry) throw new Error(`Lint entry ${resolvedId} not found.`);

  if (!canTransition(entry.status, status)) {
    throw new Error(
      `Cannot transition lint entry ${resolvedId} from ${entry.status} to ${status}.`,
    );
  }

  updateEntryStatus(db, resolvedId, status);
  return { from: entry.status, id: resolvedId, to: status };
}

export function formatAffectedPaths(value: null | string) {
  const paths = parseAffectedPaths(value);
  return paths.length > 0 ? paths.join(', ') : 'none';
}

export function formatLintStatusText(status: LintStatusModel): string {
  const lines: string[] = [
    'Lint Observer Status:',
    `- Proposed: ${status.counts.proposed}`,
    `- Accepted: ${status.counts.accepted}`,
    `- Rejected: ${status.counts.rejected}`,
    `- Deferred: ${status.counts.deferred}`,
    `- Implemented: ${status.counts.implemented}`,
    '',
    `Total entries: ${status.total}`,
    `Throttle: ${status.saturation.activeCount}/${status.saturation.limit} proposed`,
    `Throttle active: ${status.saturation.saturated ? 'yes' : 'no'}`,
    `Stale proposed: ${status.staleProposed}`,
    `Last scan: ${status.lastScan?.scanned_at ?? 'never'}`,
  ];
  return lines.join('\n');
}

export function formatLintTemporal(entry: {
  referenced_date: null | string;
  relative_offset: null | number;
}) {
  const parts: string[] = [];
  if (entry.referenced_date) parts.push(`ref:${entry.referenced_date}`);
  if (entry.relative_offset != null) {
    const sign = entry.relative_offset >= 0 ? '+' : '';
    parts.push(`rel:${sign}${entry.relative_offset}d`);
  }
  return parts.length > 0 ? `[${parts.join(', ')}]` : 'none';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function getLintListData(db: LassoDb, opts?: { status?: LintStatus }): LintListResult {
  const entries = listEntries(db, opts?.status);
  return {
    entries: entries.map((e) => ({
      description: e.description,
      id: e.id,
      status: e.status,
    })),
  };
}

export function getLintShowData(db: LassoDb, id: string): LintShowResult | null {
  let resolvedId: string;
  try {
    resolvedId = resolveEntryId(db, id);
  } catch {
    return null;
  }

  const entry = getEntry(db, resolvedId);
  if (!entry) return null;

  return {
    entry,
    recurrences: getRecurrences(db, entry.id),
  };
}

function applyLintDetector(db: LassoDb, detectorOutput: string): ScanSummary {
  const result = parseDetectorResult(detectorOutput);
  const summary = applyDetectorResult(db, result);
  recordScanRun(db, summary);
  return summary;
}

function buildScanPersistCallback(db: LassoDb, observedTurns: number) {
  return (progress: { observedTokens: number; observedTurns?: number }) => {
    recordLintObservationProgress(db, {
      observedTokens: progress.observedTokens,
      observedTurns: progress.observedTurns ?? observedTurns,
    });
  };
}

function canTransition(from: LintStatus, to: LintStatus) {
  if (from === to) return true;

  const allowed: Record<LintStatus, LintStatus[]> = {
    accepted: ['deferred', 'implemented'],
    deferred: ['accepted', 'rejected'],
    implemented: [],
    proposed: ['accepted', 'deferred', 'rejected'],
    rejected: [],
  };

  return allowed[from].includes(to);
}

function computeScanGates(options: ComputeScanGatesInput) {
  const state = getLintObservationState(options.db);
  return checkShouldScanLint({
    activeCount: listActiveEntries(options.db, 50).length,
    config: options.config,
    currentTokens: options.observedTokens,
    currentTurns: options.observedTurns,
    lastObservedTokens: state.lastObservedTokens,
    lastObservedTurns: state.lastObservedTurns,
  });
}

function defaultDetectorRunner(prompt: string, command?: string): Promise<string> {
  return runDetector({ command, prompt });
}

function estimateTurns(conversation: string) {
  const speakerTurns = conversation.match(/^(user|assistant|system)\s*:/gim);
  if (speakerTurns) return speakerTurns.length;
  return conversation.trim().length > 0 ? 1 : 0;
}

function parseAffectedPaths(value: null | string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((path): path is string => typeof path === 'string')
      : [];
  } catch {
    return [];
  }
}

async function readDetectorOutput(
  prompt: string,
  input: LintScanInput,
  config: LassoConfig,
  detectorRunner?: (prompt: string, command?: string) => Promise<string>,
) {
  if (input.detectorOutput) return Bun.file(input.detectorOutput).text();

  const run = detectorRunner ?? defaultDetectorRunner;
  return run(prompt, input.detectorCommand ?? config.observers.lint.detectorCommand);
}

function renderExportEntry(db: LassoDb, entry: LintEntry): string[] {
  const parts: string[] = [
    `## ${entry.id.slice(0, 8)} (${entry.status})`,
    `**Created:** ${entry.created_at}`,
    `**Updated:** ${entry.updated_at}`,
    `**Category:** ${entry.category ?? 'uncategorized'}`,
    `**Severity:** ${entry.severity ?? 'medium'}`,
    `**Affected paths:** ${formatAffectedPaths(entry.affected_paths)}`,
    `**Temporal:** ${formatLintTemporal(entry)}`,
    '',
    `### Description\n${entry.description}`,
    '',
  ];

  if (entry.proposed_form) {
    parts.push(`### Proposed Form\n\`\`\`\n${entry.proposed_form}\n\`\`\``, '');
  }
  if (entry.source_excerpt) {
    parts.push(`### Source Excerpt\n> ${entry.source_excerpt.replaceAll('\n', '\n> ')}`, '');
  }

  const recurrences = getRecurrences(db, entry.id);
  if (recurrences.length > 0) {
    parts.push('### Recurrences');
    for (const r of recurrences) {
      parts.push(`- **${r.observed_at}**: ${formatLintTemporal(r)} ${r.note}`);
    }
    parts.push('');
  }

  parts.push('---', '');
  return parts;
}
