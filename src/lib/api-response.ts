import { NextResponse } from "next/server";

import { logger } from "@/lib/observability/logger";
import { recordErrorLog } from "@/lib/observability/error-log";

// PRD Section 17.1 — Standard Response Envelope.
// Success: {"success": true, "data": {...}, "meta": {...}}
// Error:   {"success": false, "error": {"code", "message", "details"}, "meta": {...}}

function meta() {
  return { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() };
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, meta: meta() }, { status });
}

// Milestone 12 — requestId is generated once here and reused in both the
// JSON response (meta.requestId, unchanged shape) and the structured log
// line, so a user-reported requestId can be grepped straight to the server
// log that produced it. 5xx responses (genuinely unexpected failures, not
// routine validation/business-rule 4xx rejections) also get a best-effort
// ErrorLog row — works standalone for the Error Dashboard and is
// Sentry-additive when SENTRY_DSN is configured, never the only record.
export function apiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  const m = meta();

  if (status >= 500) {
    logger.error({ requestId: m.requestId, code, status, details }, message);
    void recordErrorLog({ requestId: m.requestId, route: code, message });
  } else {
    logger.warn({ requestId: m.requestId, code, status }, message);
  }

  return NextResponse.json({ success: false, error: { code, message, details }, meta: m }, { status });
}
