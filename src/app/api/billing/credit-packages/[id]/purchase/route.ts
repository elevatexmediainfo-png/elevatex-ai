import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaymentProvider, PaymentProviderUnavailableError } from "@/lib/providers/payment";
import { applyCouponDiscount, CouponError } from "@/lib/coupons/engine";

// POST /api/billing/credit-packages/[id]/purchase — opens a PaymentIntent
// (Pay Per Download model's credit-top-up path) and creates a vendor order
// against whichever Payment Provider is configured. The client never talks
// to the vendor directly until it gets back `checkoutConfig`. Milestone 12 —
// an optional `couponCode` (PERCENT/FIXED only — CREDITS-type coupons are
// redeemed directly from /api/coupons/redeem instead) discounts the charged
// amount before the vendor order is created.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const pkg = await prisma.creditPackage.findUnique({ where: { id } });
  if (!pkg || !pkg.isActive) {
    return apiError("ERR_NOT_FOUND", "This credit package is not available.", 404);
  }

  const body = await req.json().catch(() => ({}));
  const couponCode = typeof body?.couponCode === "string" ? body.couponCode.trim() : "";

  let amountPaise = pkg.priceInPaise;
  if (couponCode) {
    try {
      const result = await applyCouponDiscount(session.user.id, couponCode, pkg.priceInPaise, "credit_package");
      amountPaise = result.finalAmountPaise;
    } catch (err) {
      if (err instanceof CouponError) return apiError("ERR_COUPON", err.message, 400);
      throw err;
    }
  }

  // Resolved BEFORE creating the PaymentIntent — a real production
  // deployment with no PAYMENT provider enabled must refuse the purchase
  // outright, not create an order that can never actually be paid for
  // (see PaymentProviderUnavailableError's own comment).
  let payment;
  try {
    payment = await getPaymentProvider();
  } catch (err) {
    if (err instanceof PaymentProviderUnavailableError) {
      return apiError("ERR_PAYMENTS_UNAVAILABLE", err.message, 503);
    }
    throw err;
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      userId: session.user.id,
      kind: "CREDIT_PACKAGE",
      referenceId: pkg.id,
      amountPaise,
    },
  });

  const order = await payment.createOrder({
    amountPaise,
    currency: "INR",
    receipt: intent.id,
    notes: { kind: "CREDIT_PACKAGE", creditPackageId: pkg.id, userId: session.user.id },
  });

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerOrderId: order.orderId },
  });

  return apiSuccess({ paymentIntentId: intent.id, checkoutConfig: order.checkoutConfig }, 201);
}
