import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { writeAuditLog } from "@/lib/admin/audit-log";

// Milestone 13 — grace-period sweep. renewSubscription() (fulfillment.ts)
// only ever runs when the vendor notifies us of a successful recurring
// charge; this sweep is what handles the charge NOT showing up (webhook
// lost, or the vendor's own retry still in flight) — it never calls the
// payment provider, it only reads PaymentIntent-independent subscription
// state and applies the founder-configured grace policy.

export interface SubscriptionRenewalSweepResult {
  markedPastDue: number;
  expired: number;
  stillInGracePeriod: number;
}

export async function runSubscriptionRenewalSweep(): Promise<SubscriptionRenewalSweepResult> {
  const now = new Date();
  const [gracePeriodDays, maxRetryAttempts] = await Promise.all([
    getConfig("SUBSCRIPTION_GRACE_PERIOD_DAYS"),
    getConfig("SUBSCRIPTION_RENEWAL_RETRY_ATTEMPTS"),
  ]);

  // Process subscriptions already PAST_DUE from a prior sweep run first —
  // before this pass marks any newly-lapsed ACTIVE ones PAST_DUE, so a
  // subscription is never expired on the very same pass it entered grace.
  const alreadyPastDue = await prisma.subscription.findMany({ where: { status: "PAST_DUE" } });

  let expired = 0;
  let stillInGracePeriod = 0;
  for (const sub of alreadyPastDue) {
    const graceDeadline = new Date(sub.currentPeriodEnd.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
    const attemptsExhausted = sub.renewalAttempts >= maxRetryAttempts;

    if (now >= graceDeadline || attemptsExhausted) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
      await writeAuditLog({
        userId: sub.userId,
        resource: "subscription",
        action: "renewal_grace_period_expired",
        detail: { subscriptionId: sub.id, renewalAttempts: sub.renewalAttempts },
      });
      expired += 1;
    } else {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalAttempts: { increment: 1 } },
      });
      stillInGracePeriod += 1;
    }
  }

  const lapsedActive = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now } },
  });
  for (const sub of lapsedActive) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "PAST_DUE", renewalAttempts: 1 },
    });
    await writeAuditLog({
      userId: sub.userId,
      resource: "subscription",
      action: "renewal_grace_period_started",
      detail: { subscriptionId: sub.id },
    });
  }

  return { markedPastDue: lapsedActive.length, expired, stillInGracePeriod };
}
