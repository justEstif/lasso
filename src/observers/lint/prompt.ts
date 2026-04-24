import type { LintEntry } from './db.ts';

export const LINT_DETECTOR_VERSION = 'lint-rubric-v1';

export function buildLintDetectorPrompt(conversation: string, activeEntries: LintEntry[]): string {
  return [
    '# lasso lint detector',
    '',
    `Detector version: ${LINT_DETECTOR_VERSION}`,
    '',
    'You identify durable lint-rule candidates from an agent conversation.',
    '',
    'Capture signals when the user:',
    '- corrects a recurring agent pattern',
    '- declares a reusable convention',
    '- expresses frustration that suggests an enforceable rule should exist',
    '',
    'Do not capture:',
    '- one-off task instructions',
    '- single factual corrections',
    '- momentary preferences without reusable enforcement value',
    '',
    'Return only JSON with this shape:',
    JSON.stringify(exampleOutput(), null, 2),
    '',
    'If a signal matches an active entry, set matches_existing_id to that entry id.',
    '',
    '## Active entries for deduplication',
    formatActiveEntries(activeEntries),
    '',
    '## Conversation',
    conversation,
  ].join('\n');
}

function exampleOutput() {
  return {
    entries: [
      {
        description: 'Agent keeps importing Form.Item from antd on migrated shadcn pages',
        matches_existing_id: null,
        proposed_form: "ESLint no-restricted-imports rule forbidding 'antd' in migrated pages",
        source_excerpt: "User: 'stop pulling Form.Item from antd, that page is on shadcn now'",
      },
    ],
    found_opportunity: true,
    reasoning: 'User explicitly stated a recurring convention with enforcement value.',
  };
}

function formatActiveEntries(entries: LintEntry[]) {
  if (entries.length === 0) return 'No active entries.';

  return entries
    .map((entry) => {
      return [
        `- id: ${entry.id}`,
        `  status: ${entry.status}`,
        `  description: ${entry.description}`,
        `  proposed_form: ${entry.proposed_form ?? ''}`,
      ].join('\n');
    })
    .join('\n');
}
