import { fstatSync } from 'node:fs';

import type { LassoConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';
import type { LintStatus } from './db';

import {
  buildLintExportMarkdown,
  executeLintScan,
  executeLintTransition,
  formatAffectedPaths,
  formatLintStatusText,
  formatLintTemporal,
  getLintListData,
  getLintShowData,
  type LintScanInput,
  type LintShowResult,
} from './orchestration.ts';
import { buildLintStatusModel } from './status.ts';

// ---------------------------------------------------------------------------
// CLI option types
// ---------------------------------------------------------------------------

interface LintScanOptions {
  detectorCommand?: string;
  detectorOutput?: string;
  force?: boolean;
  input?: string;
  printPrompt?: boolean;
  tokens?: string;
  turns?: string;
}

// ---------------------------------------------------------------------------
// Thin CLI wrappers (handle CLI I/O, delegate to orchestration)
// ---------------------------------------------------------------------------

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

export async function handleLintScan(db: LassoDb, options: LintScanOptions, config: LassoConfig) {
  const conversation = await readConversation(options);
  const observedTokens = options.tokens ? Number(options.tokens) : undefined;
  const observedTurns = options.turns ? Number(options.turns) : undefined;

  const input: LintScanInput = {
    conversation,
    detectorCommand: options.detectorCommand,
    detectorOutput: options.detectorOutput,
    force: options.force,
    printPrompt: options.printPrompt,
    tokens: observedTokens,
    turns: observedTurns,
  };

  const result = await executeLintScan(db, input, config);

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasReadableStdin() {
  try {
    const stat = fstatSync(0);
    return stat.isFIFO() || stat.isFile();
  } catch {
    return false;
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
