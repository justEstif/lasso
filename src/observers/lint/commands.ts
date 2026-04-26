import { fstatSync } from 'node:fs';

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
import { buildLintStatusModel } from './status.ts';

// ---------------------------------------------------------------------------
// Option / result types shared between orchestration and CLI layers
// ---------------------------------------------------------------------------

/** Structured result for the list orchestration function. */
export interface LintListResult {
  entries: Array<{ description: string; id: string; status: LintStatus }>;
}

/**
 * Check whether a lint scan should proceed based on saturation and budgets.
 *
 * Already exported — kept as a pure helper for both CLI and programmatic use.
 */
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

/** Input for the pure scan orchestration function. */
export interface LintScanInput {
  conversation: string;
  detectorCommand?: string;
  detectorOutput?: string;
  force?: boolean;
  printPrompt?: boolean;
  tokens?: number;
  turns?: number;
}

/** Discriminated result returned by the pure scan orchestration. */
export type LintScanResult =
  | { gates: ObserverLifecycleGates; type: 'skipped' }
  | { prompt: string; type: 'prompt' }
  | { summary: ScanSummary; type: 'completed' };

/** Structured result for the show orchestration function. */
export interface LintShowResult {
  entry: LintEntry;
  recurrences: LintRecurrence[];
}

/** Structured result for the transition orchestration function. */
export interface LintTransitionResult {
  from: LintStatus;
  id: string;
  to: LintStatus;
}

// ---------------------------------------------------------------------------
// Pure orchestration functions (no console.log / process.exit)
// ---------------------------------------------------------------------------

interface ComputeScanGatesInput {
  config: LassoConfig;
  db: LassoDb;
  input: LintScanInput;
  observedTokens: number;
  observedTurns: number;
}

interface LintScanOptions {
  detectorCommand?: string;
  detectorOutput?: string;
  force?: boolean;
  input?: string;
  printPrompt?: boolean;
  tokens?: string;
  turns?: string;
}

/**
 * Build a complete markdown export of all lint entries.
 *
 * Pure function — queries the DB but produces a string without CLI I/O.
 */
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
    saturation: checkSaturation({ activeCount: input.activeCount, limit: lintConfig.throttleLimit }),
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

/**
 * Execute a lint scan lifecycle: check gates → run detector → apply results.
 *
 * Returns a discriminated union so callers never need to touch process I/O.
 * The `detectorRunner` parameter is optional; omitting it uses the default
 * {@link runDetector} subprocess runner.
 */
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

/**
 * Validate and execute a lint status transition.
 *
 * Throws on invalid id, missing entry, or disallowed transition.
 */
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

/**
 * Format the lint status model as human-readable text lines.
 *
 * Pure function — takes the status model, returns printable lines.
 */
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

/**
 * Return structured list data without any CLI side-effects.
 */
export function getLintListData(
  db: LassoDb,
  opts?: { status?: LintStatus },
): LintListResult {
  const entries = listEntries(db, opts?.status);
  return {
    entries: entries.map((e) => ({
      description: e.description,
      id: e.id,
      status: e.status,
    })),
  };
}

/**
 * Return a full lint entry with its recurrences, or null if not found.
 */
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

export function handleLintExport(db: LassoDb, opts: { format: string }) {
  try {
    const markdown = buildLintExportMarkdown(db, opts);
    console.log(markdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function handleLintList(db: LassoDb, opts: { status?: LintStatus }) {
  const result = getLintListData(db, opts);

  if (result.entries.length === 0) {
    console.log('No lint entries found.');
    return;
  }

  for (const entry of result.entries) {
    console.log(`[${entry.id.slice(0, 8)}] ${entry.status.toUpperCase()}: ${entry.description}`);
  }
}

// ---------------------------------------------------------------------------
// Thin CLI wrappers (handle CLI I/O, delegate to orchestration)
// ---------------------------------------------------------------------------

export async function handleLintScan(db: LassoDb, options: LintScanOptions, config: LassoConfig) {
  const conversation = await readConversation(options);
  const observedTokens = options.tokens ? Number(options.tokens) : undefined;
  const observedTurns = options.turns ? Number(options.turns) : undefined;

  const result = await executeLintScan(
    db,
    {
      conversation,
      detectorCommand: options.detectorCommand,
      detectorOutput: options.detectorOutput,
      force: options.force,
      printPrompt: options.printPrompt,
      tokens: observedTokens,
      turns: observedTurns,
    },
    config,
  );

  if (result.type === 'prompt') {
    console.log(result.prompt);
    return;
  }

  if (result.type === 'skipped') {
    console.log(
      JSON.stringify({
        skipped: true,
        tokenBudget: result.gates.tokenBudget,
        turnBudget: result.gates.turnBudget,
      }),
    );
    return;
  }

  console.log(
    `Lint scan complete: ${result.summary.created} created, ${result.summary.recurrences} recurrences, ${result.summary.skipped} skipped.`,
  );
}

export function handleLintShow(db: LassoDb, id: string) {
  const result = getLintShowData(db, id);
  if (!result) {
    console.error(`Lint entry ${id} not found.`);
    process.exit(1);
  }
  printLintEntry(result);
}

export function handleLintStatus(db: LassoDb, config: LassoConfig) {
  const status = buildLintStatusModel(db, config);
  console.log(formatLintStatusText(status));
}

export function handleLintTransition(db: LassoDb, id: string, status: LintStatus) {
  try {
    const result = executeLintTransition(db, id, status);
    console.log(`Lint entry ${result.id} transitioned from ${result.from} to ${result.to}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
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

// ---------------------------------------------------------------------------
// Internal helpers (shared between orchestration and CLI)
// ---------------------------------------------------------------------------

function defaultDetectorRunner(prompt: string, command?: string): Promise<string> {
  return runDetector({ command, prompt });
}

function estimateTurns(conversation: string) {
  const speakerTurns = conversation.match(/^(user|assistant|system)\s*:/gim);
  if (speakerTurns) return speakerTurns.length;
  return conversation.trim().length > 0 ? 1 : 0;
}

function formatAffectedPaths(value: null | string) {
  const paths = parseAffectedPaths(value);
  return paths.length > 0 ? paths.join(', ') : 'none';
}

function formatLintTemporal(entry: {
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

function hasReadableStdin() {
  try {
    const stat = fstatSync(0);
    return stat.isFIFO() || stat.isFile();
  } catch {
    return false;
  }
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

function printLintEntry(result: LintShowResult) {
  const { entry, recurrences } = result;

  console.log(`ID: ${entry.id}`);
  console.log(`Status: ${entry.status}`);
  console.log(`Created: ${entry.created_at}`);
  console.log(`Updated: ${entry.updated_at}`);
  console.log(`Detector Version: ${entry.detector_version}`);
  console.log(`Category: ${entry.category ?? 'uncategorized'}`);
  console.log(`Severity: ${entry.severity ?? 'medium'}`);
  console.log(`Affected Paths: ${formatAffectedPaths(entry.affected_paths)}`);
  console.log(`Temporal: ${formatLintTemporal(entry)}`);
  console.log(`\nDescription:\n${entry.description}`);

  if (entry.proposed_form) console.log(`\nProposed Form:\n${entry.proposed_form}`);
  if (entry.source_excerpt) console.log(`\nSource Excerpt:\n${entry.source_excerpt}`);

  if (recurrences.length > 0) {
    console.log(`\nRecurrences (${recurrences.length}):`);
    for (const r of recurrences) {
      console.log(`- [${r.observed_at}] ${formatLintTemporal(r)} ${r.note}`);
    }
  }
}

async function readConversation(options: LintScanOptions) {
  if (options.input) return Bun.file(options.input).text();
  if (hasReadableStdin()) return Bun.stdin.text();
  return '';
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
