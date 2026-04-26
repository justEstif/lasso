#!/usr/bin/env bun

import { bootstrap } from './src/cli';
import { closeDb } from './src/db/index.ts';

bootstrap()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDb();
  });
