import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { expireStaleLots } from "@/lib/credits/engine";

// Production swap-in point for credit lot expiry (see lib/credits/engine.ts's
// expireStaleLots): point a daily scheduler (Vercel Cron, an external cron
// hitting this URL) at this route. Same secret-gating pattern as
// /api/internal/queue/process — fails closed in production, open in dev.
export async function POST(req: NextRequest) {
  const secret = process.env.CREDIT_EXPIRY_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CREDIT_EXPIRY_SECRET is not set — refusing to expire credit lots.");
      return apiError("ERR_NOT_CONFIGURED", "Credit expiry is not configured.", 500);
    }
  } else {
    const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return apiError("ERR_UNAUTHORIZED", "Invalid or missing credit expiry secret.", 401);
    }
  }

  const result = await expireStaleLots();
  return apiSuccess(result);
}
