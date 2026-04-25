import { Database } from 'bun:sqlite';
import { fstatSync } from 'node:fs';

import type { LassoConfig } from '../../config/load.ts';
import type { LintStatus } from './db';

import {
  getEntry,
  getLintObservationState,
  getRecurrences,
  listActiveEntries,
  listEntries,
  recordLintObservationTokenCount,
  recordScanRun,
  resolveEntryId,
  updateEntryStatus,
} from './db';
import { applyDetectorResult, parseDetectorResult } from './detector.ts';
import { checkSaturation, checkTokenBudget, runObserverLifecycle } from '../service.ts';
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
}

export interface LintScanGateResult {
  saturation: ReturnType<typeof checkSaturation>;
  tokenBudget: ReturnType<typeof checkTokenBudget>;
}

export function checkShouldScanLint(
  activeCount: number,
  currentTokens: number,
  lastObservedTokens: number,
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
  };
}

export async function handleLintScan(db: Database, options: LintScanOptions, config: LassoConfig) {
  const conversation = await readConversation(options);
  const activeEntries = listActiveEntries(db, 50);
  const observedTokens = options.tokens ? Number(options.tokens) : estimateTokens(conversation);
  const gates = checkShouldScanLint(
    activeEntries.length,
    observedTokens,
    getLintObservationState(db),
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
    persistProgress: (tokens) => recordLintObservationTokenCount(db, tokens),
  });

  if (observation.skipped) {
    console.log(JSON.stringify({ ...observation.gates.tokenBudget, skipped: true }));
    return;
  }

  console.log(
    `Lint scan complete: ${observation.result.created} created, ${observation.result.recurrences} recurrences, ${observation.result.skipped} skipped.`,
  );
}

function applyLintDetector(db: Database, detectorOutput: string) {
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

export function handleLintList(db: Database, opts: { status?: LintStatus }) {
  const entries = listEntries(db, opts.status);

  if (entries.length === 0) {
    console.log('No lint entries found.');
    return;
  }

  for (const entry of entries) {
    console.log(`[${entry.id.slice(0, 8)}] ${entry.status.toUpperCase()}: ${entry.description}`);
  }
}

export function handleLintShow(db: Database, id: string) {
  const entry = getEntry(db, resolveIdOrExit(db, id));
  if (!entry) process.exit(1);

  console.log(`ID: ${entry.id}`);
  console.log(`Status: ${entry.status}`);
  console.log(`Created: ${entry.created_at}`);
  console.log(`Updated: ${entry.updated_at}`);
  console.log(`Detector Version: ${entry.detector_version}`);
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
      console.log(`- [${r.observed_at}] ${r.note}`);
    }
  }
}

export function handleLintTransition(db: Database, id: string, status: LintStatus) {
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

function resolveIdOrExit(db: Database, id: string) {
  try {
    return resolveEntryId(db, id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export function handleLintStatus(db: Database, config: LassoConfig) {
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

export function handleLintExport(db: Database, opts: { format: string }) {
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
    console.log(`**Updated:** ${entry.updated_at}\n`);
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
        console.log(`- **${r.observed_at}**: ${r.note}`);
      }
      console.log('');
    }

    console.log('---\n');
  }
}
