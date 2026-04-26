import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import path from 'node:path';

import type { LassoDb } from './index.ts';

const migrationsFolder = path.join(import.meta.dir, '..', '..', 'drizzle');

export function runMigrations(db: LassoDb) {
  migrate(db, { migrationsFolder });
}
