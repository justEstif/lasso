import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { resolveLassoPaths } from '../project/paths.ts';
import * as schema from './schema.ts';

export type LassoDb = ReturnType<typeof drizzle<typeof schema>>;

let clientInstance: null | PGlite = null;
let dbInstance: LassoDb | null = null;
let dbInstancePath: null | string = null;

export async function closeDb(): Promise<void> {
  if (clientInstance) await clientInstance.close();
  clientInstance = null;
  dbInstance = null;
  dbInstancePath = null;
}

export async function getDb(cwd: string = process.cwd()): Promise<LassoDb> {
  const { lassoDir } = resolveLassoPaths(cwd);
  const dbPath = path.join(lassoDir, 'pglite');
  if (dbInstance && dbInstancePath === dbPath) return dbInstance;
  if (dbInstance) await closeDb();
  mkdirSync(dbPath, { recursive: true });

  clientInstance = new PGlite(dbPath);
  await clientInstance.waitReady;
  dbInstance = drizzle(clientInstance, { schema });
  dbInstancePath = dbPath;

  return dbInstance;
}

export async function getMemoryDb(): Promise<LassoDb> {
  const client = new PGlite('memory://');
  await client.waitReady;
  return drizzle(client, { schema });
}
