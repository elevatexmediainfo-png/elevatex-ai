import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";

// Milestone 12 — captures uncaught/5xx API errors so the Error Dashboard
// has something to show even with no Sentry configured. Never throws — an
// error-logging failure must never mask or replace the original error
// response. Sentry-additive: Sentry.captureException is a genuine no-op
// when SENTRY_DSN is unset (see sentry.server.config.ts).

export interface RecordErrorLogInput {
  requestId?: string;
  route: string;
  message: string;
  stack?: string;
}

export async function recordErrorLog(input: RecordErrorLogInput): Promise<void> {
  try {
    await prisma.errorLog.create({
      data: { requestId: input.requestId, route: input.route, message: input.message, stack: input.stack },
    });
  } catch (err) {
    console.error("[error-log] failed to persist ErrorLog row", err);
  }

  Sentry.captureMessage(input.message, { level: "error", tags: { route: input.route, requestId: input.requestId } });
}

export async function listRecentErrors(limit = 50) {
  return prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
