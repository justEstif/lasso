import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import path from 'node:path';

const migrationsFolder = path.join(import.meta.dir, '..', '..', 'drizzle');

export function runMigrations(db: Database) {
  migrate(drizzle(db), { migrationsFolder });
}
