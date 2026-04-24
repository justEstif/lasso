import * as Sentry from '@sentry/bun';

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://examplePublicKey@o0.ingest.sentry.io/0',
  tracesSampleRate: 1.0,
});

export const logger = {
  error: (msg: string, ...args: any[]) => {
    Sentry.captureMessage(msg, 'error');
    if (args.length > 0) {
      Sentry.setExtra('args', args);
    }
  },
  info: (msg: string) => {
    Sentry.captureMessage(msg, 'info');
  },
};
