import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';

import type { LassoDb } from './index.ts';

const migrationsFolder = path.join(import.meta.dir, '..', '..', 'drizzle');

export async function runMigrations(db: LassoDb): Promise<void> {
  await migrate(db, { migrationsFolder });
}
