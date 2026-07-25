import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaymentProvider, PaymentProviderUnavailableError } from "@/lib/providers/payment";
import { getReadyProject, findExistingDownload, VideoNotReadyError } from "@/lib/downloads/download-service";
import {
  assertPurchasablePrice,
  findActivePayPerDownloadPlan,
  PayPerDownloadNotConfiguredError,
} from "@/lib/billing/pay-per-download";

// POST /api/videos/[id]/purchase — the Pay Per Download model's one-time
// path: pay for a single video's master download without buying a credit
// package or subscribing. Opens a PaymentIntent (kind ONE_TIME_DOWNLOAD)
// against the admin-priced "Pay Per Download" PricingPlan and creates a
// vendor order, mirroring /api/billing/credit-packages/[id]/purchase. Once
// the vendor confirms (webhook or mock confirm), lib/billing/fulfillment.ts
// records the entitlement and the existing /api/videos/[id]/download route
// picks it up as an already-owned, no-recharge download.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    await getReadyProject(session.user.id, id);
  } catch (err) {
    if (err instanceof VideoNotReadyError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    if (err instanceof Error && err.message === "Video project not found.") {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    throw err;
  }

  const existing = await findExistingDownload(session.user.id, id);
  if (existing) {
    return apiError(
      "ERR_INVALID_STATE",
      "You already have access to this download — no need to buy it.",
      409
    );
  }

  const plan = await findActivePayPerDownloadPlan();
  try {
    assertPurchasablePrice(plan?.priceInPaise ?? 0);
  } catch (err) {
    if (err instanceof PayPerDownloadNotConfiguredError) {
      return apiError("ERR_NOT_CONFIGURED", err.message, 409);
    }
    throw err;
  }
  // assertPurchasablePrice already guarantees plan is non-null when it
  // doesn't throw (priceInPaise <= 0 covers the null/missing-plan case too).
  const activePlan = plan!;

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
      kind: "ONE_TIME_DOWNLOAD",
      referenceId: id,
      amountPaise: activePlan.priceInPaise,
    },
  });

  const order = await payment.createOrder({
    amountPaise: activePlan.priceInPaise,
    currency: "INR",
    receipt: intent.id,
    notes: { kind: "ONE_TIME_DOWNLOAD", videoProjectId: id, userId: session.user.id },
  });

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerOrderId: order.orderId },
  });

  return apiSuccess({ paymentIntentId: intent.id, checkoutConfig: order.checkoutConfig }, 201);
}
