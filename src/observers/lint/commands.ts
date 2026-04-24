import { Database } from 'bun:sqlite';

import type { LassoConfig } from '../../config/load.ts';

import {
  getEntry,
  getLastScanRun,
  getRecurrences,
  listActiveEntries,
  listEntries,
  LintStatus,
  recordScanRun,
  resolveEntryId,
  updateEntryStatus,
} from './db';
import { applyDetectorResult, parseDetectorResult } from './detector.ts';
import { buildLintDetectorPrompt } from './prompt.ts';
import { runDetector } from './runner.ts';

interface LintScanOptions {
  detectorCommand?: string;
  detectorOutput?: string;
  input?: string;
  printPrompt?: boolean;
}

export async function handleLintScan(db: Database, options: LintScanOptions, config: LassoConfig) {
  const conversation = await readConversation(options);
  const prompt = buildLintDetectorPrompt(conversation, listActiveEntries(db, 50));

  if (options.printPrompt) {
    console.log(prompt);
    return;
  }

  const detectorOutput = await readDetectorOutput(prompt, options, config);
  const result = parseDetectorResult(detectorOutput);
  const summary = applyDetectorResult(db, result);
  recordScanRun(db, summary);
  console.log(
    `Lint scan complete: ${summary.created} created, ${summary.recurrences} recurrences, ${summary.skipped} skipped.`,
  );
}

async function readConversation(options: LintScanOptions) {
  if (options.input) return Bun.file(options.input).text();
  if (options.printPrompt) return Bun.stdin.text();
  return '';
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
  const entries = listEntries(db);
  const counts = countByStatus(entries);
  const lintConfig = config.observers.lint;
  const staleCount = countStaleProposed(entries, lintConfig.staleAfterDays);
  const lastScan = getLastScanRun(db);

  console.log('Lint Observer Status:');
  console.log(`- Proposed: ${counts.proposed}`);
  console.log(`- Accepted: ${counts.accepted}`);
  console.log(`- Rejected: ${counts.rejected}`);
  console.log(`- Deferred: ${counts.deferred}`);
  console.log(`- Implemented: ${counts.implemented}`);
  console.log(`\nTotal entries: ${entries.length}`);
  console.log(`Throttle: ${counts.proposed}/${lintConfig.throttleLimit} proposed`);
  console.log(`Throttle active: ${counts.proposed >= lintConfig.throttleLimit ? 'yes' : 'no'}`);
  console.log(`Stale proposed: ${staleCount}`);
  console.log(`Last scan: ${lastScan?.scanned_at ?? 'never'}`);
}

function countByStatus(entries: ReturnType<typeof listEntries>) {
  const counts = { accepted: 0, deferred: 0, implemented: 0, proposed: 0, rejected: 0 };

  for (const entry of entries) {
    counts[entry.status]++;
  }

  return counts;
}

function countStaleProposed(entries: ReturnType<typeof listEntries>, staleAfterDays: number) {
  const staleBefore = Date.now() - staleAfterDays * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    return entry.status === 'proposed' && new Date(entry.created_at).getTime() < staleBefore;
  }).length;
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
