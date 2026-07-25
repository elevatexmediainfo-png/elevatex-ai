import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listSubscriptions } from "@/lib/admin/subscriptions";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const status = req.nextUrl.searchParams.get("status") as SubscriptionStatus | null;
  const subscriptions = await listSubscriptions({ status: status ?? undefined });

  return apiSuccess({ subscriptions });
}
