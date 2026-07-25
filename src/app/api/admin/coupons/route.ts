import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { listCoupons, createCoupon } from "@/lib/coupons/engine";

const createSchema = z.object({
  code: z.string().min(3).max(20),
  discountType: z.enum(["PERCENT", "FIXED", "CREDITS"]),
  value: z.number().min(0),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const coupons = await listCoupons();
  return apiSuccess({ coupons });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid coupon.", 400, { issues: parsed.error.issues });
  }

  const coupon = await createCoupon({
    ...parsed.data,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
  });
  return apiSuccess({ coupon }, 201);
}
