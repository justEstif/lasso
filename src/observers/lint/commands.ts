import { Database } from 'bun:sqlite';
import { listEntries, getEntry, updateEntryStatus, getRecurrences, LintStatus } from './db';
import { applyDetectorResult, parseDetectorResult } from './detector.ts';

export async function handleLintScan(db: Database) {
  const input = await Bun.stdin.text();
  if (input.trim().length === 0) {
    console.error('lint scan expects detector JSON on stdin for the MVP scaffold.');
    process.exit(1);
  }

  const result = parseDetectorResult(input);
  const summary = applyDetectorResult(db, result);
  console.log(`Lint scan complete: ${summary.created} created, ${summary.recurrences} recurrences, ${summary.skipped} skipped.`);
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
  const entry = getEntry(db, id);
  if (!entry) {
    console.error(`Lint entry ${id} not found.`);
    process.exit(1);
  }

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
  const entry = getEntry(db, id);
  if (!entry) {
    console.error(`Lint entry ${id} not found.`);
    process.exit(1);
  }

  updateEntryStatus(db, id, status);
  console.log(`Lint entry ${id} transitioned from ${entry.status} to ${status}.`);
}

export function handleLintStatus(db: Database) {
  const entries = listEntries(db);
  
  const counts = {
    proposed: 0,
    accepted: 0,
    rejected: 0,
    deferred: 0,
    implemented: 0
  };

  for (const entry of entries) {
    if (entry.status in counts) {
      counts[entry.status as keyof typeof counts]++;
    }
  }

  console.log('Lint Observer Status:');
  console.log(`- Proposed: ${counts.proposed}`);
  console.log(`- Accepted: ${counts.accepted}`);
  console.log(`- Rejected: ${counts.rejected}`);
  console.log(`- Deferred: ${counts.deferred}`);
  console.log(`- Implemented: ${counts.implemented}`);
  console.log(`\nTotal entries: ${entries.length}`);
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
