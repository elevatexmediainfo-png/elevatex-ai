import * as Sentry from "@sentry/nextjs";

// Optional, env-gated like every other external integration in this
// codebase (Google OAuth, MSG91, real AI providers) — Sentry.init() is a
// genuine no-op internally when never called, so every Sentry.* call
// elsewhere (captureException, captureRequestError) is always safe to leave
// in place regardless of whether SENTRY_DSN is configured.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Request tracing reuses the app's own meta.requestId (see
    // lib/api-response.ts) rather than a second trace-id scheme — attached
    // to the Sentry scope at the point an error is reported, not here.
  });
}
