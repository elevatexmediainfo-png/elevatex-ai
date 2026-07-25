import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getPaymentProvider } from "@/lib/providers/payment";
import { writeAuditLog } from "@/lib/admin/audit-log";

// POST /api/billing/subscriptions/cancel — cancel-at-period-end (the
// standard SaaS default: stay entitled through what's already been paid
// for, no proration/refund logic needed). Calls the configured Payment
// Provider so a real vendor's recurring billing actually stops; Mock is a
// no-op there.
export async function POST() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (!subscription) {
    return apiError("ERR_NOT_FOUND", "You don't have an active subscription.", 404);
  }
  if (subscription.cancelAtPeriodEnd) {
    return apiError("ERR_INVALID_STATE", "This subscription is already set to cancel.", 409);
  }

  if (subscription.providerRef) {
    const payment = await getPaymentProvider();
    await payment.cancelSubscription({
      subscriptionId: subscription.providerRef,
      cancelAtPeriodEnd: true,
    });
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true },
  });

  await writeAuditLog({
    userId: session.user.id,
    resource: "subscription",
    action: "cancel",
    detail: { subscriptionId: subscription.id },
  });

  return apiSuccess({ subscription: updated });
}
