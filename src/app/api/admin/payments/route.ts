import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listPaymentIntents } from "@/lib/admin/payments";
import type { PaymentIntentKind, PaymentIntentStatus } from "@/generated/prisma/enums";

// GET /api/admin/payments?status=&kind=&limit= — read-only PaymentIntent list
// for the new /admin/payments page. Enable/disable/priority/test-connection
// for the PAYMENT provider category already exist at /api/admin/ai-providers
// — this route is purely the payments-specific lens the brief asked for on
// top of that, not a second provider-management mechanism.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as PaymentIntentStatus | null;
  const kind = searchParams.get("kind") as PaymentIntentKind | null;
  const limit = Number(searchParams.get("limit") ?? 50);

  const intents = await listPaymentIntents({
    status: status ?? undefined,
    kind: kind ?? undefined,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return apiSuccess({ intents });
}
