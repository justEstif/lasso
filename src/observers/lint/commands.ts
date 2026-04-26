import { fstatSync } from 'node:fs';

import type { LassoDb } from '../../db/index.ts';
import type { LassoConfig } from '../../config/load.ts';
import type { LintStatus } from './db';

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
import {
  checkSaturation,
  checkTokenBudget,
  checkTurnBudget,
  runObserverLifecycle,
} from '../service.ts';
import { estimateTokens } from '../memory/tokens.ts';
import { buildLintDetectorPrompt } from './prompt.ts';
import { runDetector } from './runner.ts';
import { buildLintStatusModel } from './status.ts';

interface LintScanOptions {
  detectorCommand?: string;
  detectorOutput?: string;
  force?: boolean;
  input?: string;
  printPrompt?: boolean;
  tokens?: string;
  turns?: string;
}

export interface LintScanGateResult {
  saturation: ReturnType<typeof checkSaturation>;
  tokenBudget: ReturnType<typeof checkTokenBudget>;
  turnBudget: ReturnType<typeof checkTurnBudget>;
}

export function checkShouldScanLint(
  activeCount: number,
  currentTokens: number,
  lastObservedTokens: number,
  currentTurns: number,
  lastObservedTurns: number,
  config: LassoConfig,
): LintScanGateResult {
  const lintConfig = config.observers.lint;

  return {
    saturation: checkSaturation({ activeCount, limit: lintConfig.throttleLimit }),
    tokenBudget: checkTokenBudget({
      currentTokens,
      lastObservedTokens,
      thresholdTokens: lintConfig.scanThresholdTokens,
    }),
    turnBudget: checkTurnBudget({
      currentTurns,
      lastObservedTurns,
      thresholdTurns: lintConfig.scanThresholdTurns,
    }),
  };
}

export async function handleLintScan(db: LassoDb, options: LintScanOptions, config: LassoConfig) {
  const conversation = await readConversation(options);
  const activeEntries = listActiveEntries(db, 50);
  const observedTokens = options.tokens ? Number(options.tokens) : estimateTokens(conversation);
  const observedTurns = options.turns ? Number(options.turns) : estimateTurns(conversation);
  const observationState = getLintObservationState(db);
  const gates = checkShouldScanLint(
    activeEntries.length,
    observedTokens,
    observationState.lastObservedTokens,
    observedTurns,
    observationState.lastObservedTurns,
    config,
  );

  const prompt = buildLintDetectorPrompt(conversation, activeEntries);

  if (options.printPrompt) {
    console.log(prompt);
    return;
  }

  const observation = await runObserverLifecycle({
    force: options.force,
    gates,
    observe: async () => applyLintDetector(db, await readDetectorOutput(prompt, options, config)),
    persistProgress: (progress) => {
      recordLintObservationProgress(db, {
        observedTokens: progress.observedTokens,
        observedTurns: progress.observedTurns ?? observedTurns,
      });
    },
  });

  if (observation.skipped) {
    console.log(
      JSON.stringify({
        skipped: true,
        tokenBudget: observation.gates.tokenBudget,
        turnBudget: observation.gates.turnBudget,
      }),
    );
    return;
  }

  console.log(
    `Lint scan complete: ${observation.result.created} created, ${observation.result.recurrences} recurrences, ${observation.result.skipped} skipped.`,
  );
}

function applyLintDetector(db: LassoDb, detectorOutput: string) {
  const result = parseDetectorResult(detectorOutput);
  const summary = applyDetectorResult(db, result);
  recordScanRun(db, summary);
  return summary;
}

async function readConversation(options: LintScanOptions) {
  if (options.input) return Bun.file(options.input).text();
  if (hasReadableStdin()) return Bun.stdin.text();
  return '';
}

function estimateTurns(conversation: string) {
  const speakerTurns = conversation.match(/^(user|assistant|system)\s*:/gim);
  if (speakerTurns) return speakerTurns.length;
  return conversation.trim().length > 0 ? 1 : 0;
}

function hasReadableStdin() {
  try {
    const stat = fstatSync(0);
    return stat.isFIFO() || stat.isFile();
  } catch {
    return false;
  }
}

async function readDetectorOutput(prompt: string, options: LintScanOptions, config: LassoConfig) {
  if (options.detectorOutput) return Bun.file(options.detectorOutput).text();

  return runDetector({
    command: options.detectorCommand ?? config.observers.lint.detectorCommand,
    prompt,
  });
}

export function handleLintList(db: LassoDb, opts: { status?: LintStatus }) {
  const entries = listEntries(db, opts.status);

  if (entries.length === 0) {
    console.log('No lint entries found.');
    return;
  }

  for (const entry of entries) {
    console.log(`[${entry.id.slice(0, 8)}] ${entry.status.toUpperCase()}: ${entry.description}`);
  }
}

export function handleLintShow(db: LassoDb, id: string) {
  const entry = getEntry(db, resolveIdOrExit(db, id));
  if (!entry) process.exit(1);

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

  if (entry.proposed_form) {
    console.log(`\nProposed Form:\n${entry.proposed_form}`);
  }

  if (entry.source_excerpt) {
    console.log(`\nSource Excerpt:\n${entry.source_excerpt}`);
  }

  const recurrences = getRecurrences(db, entry.id);
  if (recurrences.length > 0) {
    console.log(`\nRecurrences (${recurrences.length}):`);
    for (const r of recurrences) {
      console.log(`- [${r.observed_at}] ${formatLintTemporal(r)} ${r.note}`);
    }
  }
}

export function handleLintTransition(db: LassoDb, id: string, status: LintStatus) {
  const resolvedId = resolveIdOrExit(db, id);
  const entry = getEntry(db, resolvedId);
  if (!entry) process.exit(1);

  if (!canTransition(entry.status, status)) {
    console.error(`Cannot transition lint entry ${resolvedId} from ${entry.status} to ${status}.`);
    process.exit(1);
  }

  updateEntryStatus(db, resolvedId, status);
  console.log(`Lint entry ${resolvedId} transitioned from ${entry.status} to ${status}.`);
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

function resolveIdOrExit(db: LassoDb, id: string) {
  try {
    return resolveEntryId(db, id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function handleLintStatus(db: LassoDb, config: LassoConfig) {
  const status = buildLintStatusModel(db, config);

  console.log('Lint Observer Status:');
  console.log(`- Proposed: ${status.counts.proposed}`);
  console.log(`- Accepted: ${status.counts.accepted}`);
  console.log(`- Rejected: ${status.counts.rejected}`);
  console.log(`- Deferred: ${status.counts.deferred}`);
  console.log(`- Implemented: ${status.counts.implemented}`);
  console.log(`\nTotal entries: ${status.total}`);
  console.log(`Throttle: ${status.saturation.activeCount}/${status.saturation.limit} proposed`);
  console.log(`Throttle active: ${status.saturation.saturated ? 'yes' : 'no'}`);
  console.log(`Stale proposed: ${status.staleProposed}`);
  console.log(`Last scan: ${status.lastScan?.scanned_at ?? 'never'}`);
}

export function handleLintExport(db: LassoDb, opts: { format: string }) {
  if (opts.format !== 'markdown') {
    console.error('Only markdown export is supported in MVP.');
    process.exit(1);
  }

  const entries = listEntries(db);
  if (entries.length === 0) {
    console.log('# Lint Observer Export\n\nNo entries found.');
    return;
  }

  console.log('# Lint Observer Export\n');

  for (const entry of entries) {
    console.log(`## ${entry.id.slice(0, 8)} (${entry.status})`);
    console.log(`**Created:** ${entry.created_at}`);
    console.log(`**Updated:** ${entry.updated_at}`);
    console.log(`**Category:** ${entry.category ?? 'uncategorized'}`);
    console.log(`**Severity:** ${entry.severity ?? 'medium'}`);
    console.log(`**Affected paths:** ${formatAffectedPaths(entry.affected_paths)}`);
    console.log(`**Temporal:** ${formatLintTemporal(entry)}\n`);
    console.log(`### Description\n${entry.description}\n`);

    if (entry.proposed_form) {
      console.log(`### Proposed Form\n\`\`\`\n${entry.proposed_form}\n\`\`\`\n`);
    }

    if (entry.source_excerpt) {
      console.log(`### Source Excerpt\n> ${entry.source_excerpt.replace(/\n/g, '\n> ')}\n`);
    }

    const recurrences = getRecurrences(db, entry.id);
    if (recurrences.length > 0) {
      console.log(`### Recurrences`);
      for (const r of recurrences) {
        console.log(`- **${r.observed_at}**: ${formatLintTemporal(r)} ${r.note}`);
      }
      console.log('');
    }

    console.log('---\n');
  }
}
