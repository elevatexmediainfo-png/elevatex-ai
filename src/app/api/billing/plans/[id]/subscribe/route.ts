import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaymentProvider, PaymentProviderUnavailableError } from "@/lib/providers/payment";

const SUBSCRIPTION_TOTAL_CYCLES = 12; // 1 year, auto-renewing up to this cap

// POST /api/billing/plans/[id]/subscribe — opens a PaymentIntent for the
// Monthly Subscription model and creates a vendor-side recurring
// subscription. Fulfilment (granting the first cycle's credits, activating
// the Subscription row) only happens once the vendor confirms payment via
// webhook (or the mock confirm endpoint) — never here.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const plan = await prisma.pricingPlan.findUnique({ where: { id } });
  if (!plan || !plan.isActive || plan.billingModel !== "SUBSCRIPTION") {
    return apiError("ERR_NOT_FOUND", "This plan is not available.", 404);
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (existing) {
    return apiError("ERR_INVALID_STATE", "You already have an active subscription.", 409);
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
      kind: "SUBSCRIPTION",
      referenceId: plan.id,
      amountPaise: plan.priceInPaise,
    },
  });

  const subscription = await payment.createSubscription({
    planRef: plan.providerPlanRef ?? plan.id,
    totalCount: SUBSCRIPTION_TOTAL_CYCLES,
    notes: { kind: "SUBSCRIPTION", planId: plan.id, userId: session.user.id },
  });

  // Reused column: for subscriptions there's no separate "order", so the
  // vendor's durable subscription id is what we look the PaymentIntent back
  // up by once the activation webhook arrives.
  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerOrderId: subscription.subscriptionId },
  });

  return apiSuccess({ paymentIntentId: intent.id, checkoutConfig: subscription.checkoutConfig }, 201);
}
