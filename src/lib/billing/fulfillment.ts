import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits/engine";
import { recordPurchasedDownload } from "@/lib/downloads/download-service";
import { createInvoiceForPaymentIntent } from "@/lib/billing/invoices";
import { addBillingInterval } from "@/lib/billing/interval";

// The single business-logic entry point for "a payment actually settled" —
// called both by the real, signature-verified Razorpay webhook
// (app/api/billing/webhook) and by the mock-mode confirm endpoint
// (app/api/billing/mock/confirm). Neither caller decides what fulfilment
// means for a given PaymentIntent.kind; that lives here, keyed off our own
// row rather than trusting client/webhook-supplied amounts or product ids.
export async function fulfillPaymentIntent(paymentIntentId: string, providerPaymentId?: string) {
  const intent = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: paymentIntentId } });

  // Idempotent — a redelivered webhook (or a duplicate mock confirm call)
  // must never double-grant credits or double-create a subscription.
  if (intent.status === "PAID") return intent;
  if (intent.status !== "PENDING") {
    throw new Error(`PaymentIntent ${paymentIntentId} is ${intent.status}, not PENDING.`);
  }

  await prisma.$transaction(async (tx) => {
    if (intent.kind === "CREDIT_PACKAGE") {
      const pkg = await tx.creditPackage.findUniqueOrThrow({ where: { id: intent.referenceId } });
      await grantCredits(
        {
          userId: intent.userId,
          lotType: "PURCHASED",
          transactionType: "PURCHASE",
          amount: pkg.creditAmount,
          sourceRef: intent.id,
          description: `Purchased ${pkg.name}`,
        },
        tx
      );
    } else if (intent.kind === "SUBSCRIPTION") {
      const plan = await tx.pricingPlan.findUniqueOrThrow({ where: { id: intent.referenceId } });
      const now = new Date();
      // Milestone 13 — trialDays>0 means the first period is free-trial-length,
      // not a real billing interval; renewSubscription() is what actually
      // starts charging, on the first renewal after the trial ends.
      const isTrialPeriod = plan.trialDays > 0;
      const periodEnd = isTrialPeriod
        ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
        : addBillingInterval(now, plan.billingInterval ?? "MONTHLY");

      await tx.subscription.create({
        data: {
          userId: intent.userId,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          isTrialPeriod,
          // The vendor's SUBSCRIPTION id (not the payment id) — the subscribe
          // route stored it in providerOrderId since subscriptions have no
          // separate "order". This is what cancelSubscription() needs later;
          // storing providerPaymentId here would silently break cancellation
          // against a real vendor.
          providerRef: intent.providerOrderId ?? undefined,
        },
      });

      if (plan.monthlyCredits > 0) {
        await grantCredits(
          {
            userId: intent.userId,
            lotType: "SUBSCRIPTION",
            transactionType: "SUBSCRIPTION_GRANT",
            amount: plan.monthlyCredits,
            expiresAt: periodEnd,
            sourceRef: intent.id,
            description: isTrialPeriod
              ? `${plan.name} trial credit grant`
              : `${plan.name} monthly credit grant`,
          },
          tx
        );
      }
    } else if (intent.kind === "ONE_TIME_DOWNLOAD") {
      await recordPurchasedDownload(
        {
          userId: intent.userId,
          videoProjectId: intent.referenceId,
          amountPaidPaise: intent.amountPaise,
          providerRef: providerPaymentId,
        },
        tx
      );
    }

    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "PAID", providerPaymentId },
    });

    // GST-ready invoice — every settled PaymentIntent gets exactly one,
    // regardless of kind. The PDF itself renders lazily on first download.
    await createInvoiceForPaymentIntent(intent, tx);
  });

  return prisma.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
}

// Recurring-billing path: Razorpay (or any vendor) re-notifies on each
// renewal charge for an already-active subscription, with no fresh
// PaymentIntent of ours involved. Extends the period and grants another
// cycle of credits; a no-op for subscriptions the user has since cancelled.
export async function renewSubscription(subscriptionId: string) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  // PAST_DUE is accepted too — Milestone 13's renewal sweep
  // (lib/billing/subscription-renewal.ts) moves a subscription there when
  // its period lapses with no renewal notification; a webhook that finally
  // arrives afterward should heal it back to ACTIVE, not be ignored.
  if (subscription.status !== "ACTIVE" && subscription.status !== "PAST_DUE") return subscription;

  const newPeriodEnd = addBillingInterval(
    subscription.currentPeriodEnd,
    subscription.plan.billingInterval ?? "MONTHLY"
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: subscription.currentPeriodEnd,
        currentPeriodEnd: newPeriodEnd,
        // First renewal after a trial always transitions to a real paid
        // period — isTrialPeriod never gets set back to true afterward.
        isTrialPeriod: false,
        renewalAttempts: 0,
      },
    });

    if (subscription.plan.monthlyCredits > 0) {
      await grantCredits(
        {
          userId: subscription.userId,
          lotType: "SUBSCRIPTION",
          transactionType: "SUBSCRIPTION_GRANT",
          amount: subscription.plan.monthlyCredits,
          expiresAt: newPeriodEnd,
          sourceRef: subscription.id,
          description: `${subscription.plan.name} monthly credit grant (renewal)`,
        },
        tx
      );
    }

    return updated;
  });
}
