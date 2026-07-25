import { z } from "zod";

// Fails fast with a clear message at server startup instead of letting a
// missing var surface later as a cryptic error deep inside Prisma/NextAuth
// (e.g. a `pg` connection error with no mention of DATABASE_URL).
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (see .env.example)"),
  // Milestone 12 — all optional (every integration they gate is itself
  // optional/env-fallback, see lib/cache/cache.ts, sentry.server.config.ts,
  // lib/providers/email/resend.provider.ts), but validated with the same
  // "fail fast with a clear message" posture as the required vars above
  // rather than surfacing as a cryptic runtime error the first time they're
  // actually used.
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL if set").optional(),
  SENTRY_DSN: z.string().url("SENTRY_DSN must be a valid URL if set").optional(),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY must not be empty if set").optional(),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `Missing or invalid required environment variable(s): ${missing}. Check .env.example.`
    );
  }
}
