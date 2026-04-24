import { bootstrap } from './src/cli';

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
