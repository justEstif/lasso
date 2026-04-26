import { afterAll } from 'bun:test';

import { getMemoryDb } from '../../src/db/index.ts';
import { runMigrations } from '../../src/db/migrations.ts';

let sharedDb: Awaited<ReturnType<typeof getMemoryDb>> | null = null;

const tables = [
  'lint_recurrences',
  'lint_entries',
  'lint_scan_runs',
  'lint_observation_state',
  'observation_entries',
  'memory_reflections',
  'memory_snapshots',
  'memory_observation_state',
  'working_memory',
];

export async function testDb() {
  if (!sharedDb) {
    sharedDb = await getMemoryDb();
    await runMigrations(sharedDb);
    return sharedDb;
  }

  await sharedDb.$client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  return sharedDb;
}

afterAll(async () => {
  if (!sharedDb) return;
  await sharedDb.$client.close();
  sharedDb = null;
});
