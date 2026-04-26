#!/usr/bin/env bun

import { bootstrap } from './src/cli';

try {
  await bootstrap();
} catch (error) {
  console.error(error);
  process.exit(1);
}
