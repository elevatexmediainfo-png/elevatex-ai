import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { getConfig } from "@/lib/admin/config";
import { drainQueue } from "@/lib/render/pipeline";

// Production swap-in point for the queue (see lib/queue/worker.ts): point a
// scheduler (Vercel Cron, an external cron hitting this URL, etc.) at this
// route instead of relying on the in-process worker loop, which only works
// on a long-lived single-instance server.
export async function POST(req: NextRequest) {
  const secret = process.env.QUEUE_PROCESS_SECRET;

  // Fail closed in production: an unset secret should block every caller,
  // not silently allow them through. Dev/local stays open by default so the
  // route is usable without extra setup.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("QUEUE_PROCESS_SECRET is not set — refusing to process the queue.");
      return apiError("ERR_NOT_CONFIGURED", "Queue processing is not configured.", 500);
    }
  } else {
    const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return apiError("ERR_UNAUTHORIZED", "Invalid or missing queue processing secret.", 401);
    }
  }

  const concurrency = await getConfig("RENDER_QUEUE_CONCURRENCY");
  const { processedCount } = await drainQueue(concurrency);

  return apiSuccess({ processedCount });
}
