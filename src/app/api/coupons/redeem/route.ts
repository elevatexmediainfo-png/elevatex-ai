import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { redeemCreditsCoupon, CouponError } from "@/lib/coupons/engine";

// POST /api/coupons/redeem — redeems a CREDITS-type coupon directly (grants
// credits immediately). PERCENT/FIXED coupons apply at checkout instead
// (see /api/billing/credit-packages/[id]/purchase's couponCode field).
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return apiError("ERR_VALIDATION", "Enter a coupon code.", 400);

  try {
    const result = await redeemCreditsCoupon(session.user.id, code);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof CouponError) return apiError("ERR_COUPON", err.message, 400);
    throw err;
  }
}
