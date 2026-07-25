import { NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createRefund, listRefunds, RefundError } from "@/lib/billing/refunds";

const createRefundSchema = z.object({
  paymentIntentId: z.string().min(1),
  amountPaise: z.number().int().min(1),
  reason: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { searchParams } = new URL(req.url);
  const paymentIntentId = searchParams.get("paymentIntentId") ?? undefined;

  const refunds = await listRefunds({ paymentIntentId });
  return apiSuccess({ refunds });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createRefundSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid refund request.", 400, { issues: parsed.error.issues });
  }

  try {
    const refund = await createRefund({ ...parsed.data, adminUserId: session.user.id });
    return apiSuccess({ refund }, 201);
  } catch (err) {
    if (err instanceof RefundError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    return apiError("ERR_INTERNAL", err instanceof Error ? err.message : "Refund failed.", 500);
  }
}
