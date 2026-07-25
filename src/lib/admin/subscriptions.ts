import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/providers/payment";
import { writeAuditLog } from "@/lib/admin/audit-log";

// Milestone 13 — admin-facing subscription list + an immediate-cancel
// action. The user-facing cancel-at-period-end flow already exists
// (api/billing/subscriptions/cancel) and is left untouched; this is a
// distinct, stronger action (cancel right now, not at period end) that only
// an admin should be able to trigger — e.g. for a chargeback or abuse case.

export interface ListSubscriptionsFilter {
  status?: SubscriptionStatus;
  limit?: number;
}

export async function listSubscriptions(filter: ListSubscriptionsFilter = {}) {
  return prisma.subscription.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      plan: { select: { id: true, name: true, billingInterval: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 50,
  });
}

export class SubscriptionAdminError extends Error {}

export async function cancelSubscriptionImmediately(subscriptionId: string, adminUserId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new SubscriptionAdminError("Subscription not found.");
  if (subscription.status !== "ACTIVE" && subscription.status !== "PAST_DUE") {
    throw new SubscriptionAdminError("Only an ACTIVE or PAST_DUE subscription can be cancelled.");
  }

  if (subscription.providerRef) {
    const payment = await getPaymentProvider();
    await payment.cancelSubscription({ subscriptionId: subscription.providerRef, cancelAtPeriodEnd: false });
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELLED", cancelAtPeriodEnd: true },
  });

  await writeAuditLog({
    userId: adminUserId,
    resource: "subscription",
    action: "admin_cancel_immediately",
    detail: { subscriptionId },
  });

  return updated;
}
