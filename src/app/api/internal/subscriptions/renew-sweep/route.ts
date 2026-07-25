import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { runSubscriptionRenewalSweep } from "@/lib/billing/subscription-renewal";

// Production swap-in point for the subscription grace-period sweep (see
// lib/billing/subscription-renewal.ts): point a daily scheduler (Vercel
// Cron, an external cron hitting this URL) at this route. Same
// secret-gating pattern as /api/internal/credits/expire — fails closed in
// production, open in dev.
export async function POST(req: NextRequest) {
  const secret = process.env.SUBSCRIPTION_RENEWAL_SWEEP_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("SUBSCRIPTION_RENEWAL_SWEEP_SECRET is not set — refusing to run the renewal sweep.");
      return apiError("ERR_NOT_CONFIGURED", "Subscription renewal sweep is not configured.", 500);
    }
  } else {
    const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return apiError("ERR_UNAUTHORIZED", "Invalid or missing subscription renewal sweep secret.", 401);
    }
  }

  const result = await runSubscriptionRenewalSweep();
  return apiSuccess(result);
}
