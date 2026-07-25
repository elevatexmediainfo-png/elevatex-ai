import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listWebhookEvents } from "@/lib/billing/webhook-log";

// GET /api/admin/payments/webhooks?status=&limit= — the webhook event log
// Milestone 13 introduced (lib/billing/webhook-log.ts) had nowhere to be
// viewed from before this route existed.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "RECEIVED" | "PROCESSED" | "FAILED" | null;
  const limit = Number(searchParams.get("limit") ?? 50);

  const events = await listWebhookEvents({
    status: status ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return apiSuccess({ events });
}
