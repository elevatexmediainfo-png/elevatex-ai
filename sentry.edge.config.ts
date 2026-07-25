import * as Sentry from "@sentry/nextjs";

// Same gating as sentry.server.config.ts — covers the edge runtime
// (middleware.ts). Client-side (browser) Sentry instrumentation is a
// deliberate scope cut this milestone — see KNOWN_LIMITATIONS.md.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
