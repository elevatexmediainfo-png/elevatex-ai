import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { fulfillPaymentIntent, renewSubscription } from "@/lib/billing/fulfillment";
import { writeAuditLog } from "@/lib/admin/audit-log";
import type { WebhookEvent as VendorWebhookEvent } from "@/lib/providers/payment/types";

export class WebhookEventNotFoundError extends Error {}

interface DispatchResult {
  relatedPaymentIntentId?: string;
  relatedSubscriptionId?: string;
}

// Milestone 13 — extracted verbatim from the switch that used to live inline
// in app/api/billing/webhook/route.ts, so the exact same dispatch logic can
// be re-run by the admin "Retry" action against a stored payload, not just
// live inbound requests. fulfillPaymentIntent()/renewSubscription() are
// already idempotent (status checks), so re-dispatching a previously
// succeeded event is always safe.
export async function dispatchWebhookEvent(event: VendorWebhookEvent): Promise<DispatchResult> {
  switch (event.type) {
    case "payment.captured": {
      if (!event.orderId) return {};
      const intent = await prisma.paymentIntent.findFirst({
        where: { providerOrderId: event.orderId, status: "PENDING" },
      });
      if (intent) {
        await fulfillPaymentIntent(intent.id, event.paymentId);
        return { relatedPaymentIntentId: intent.id };
      }
      return {};
    }
    case "payment.failed": {
      if (!event.orderId) return {};
      const intent = await prisma.paymentIntent.findFirst({ where: { providerOrderId: event.orderId } });
      await prisma.paymentIntent.updateMany({
        where: { providerOrderId: event.orderId, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return intent ? { relatedPaymentIntentId: intent.id } : {};
    }
    case "subscription.activated": {
      if (!event.subscriptionId) return {};
      const existingSubscription = await prisma.subscription.findFirst({
        where: { providerRef: event.subscriptionId },
      });
      if (existingSubscription) {
        await renewSubscription(existingSubscription.id);
        return { relatedSubscriptionId: existingSubscription.id };
      }
      const intent = await prisma.paymentIntent.findFirst({
        where: { kind: "SUBSCRIPTION", status: "PENDING", providerOrderId: event.subscriptionId },
      });
      if (intent) {
        await fulfillPaymentIntent(intent.id, event.paymentId);
        return { relatedPaymentIntentId: intent.id };
      }
      return {};
    }
    case "subscription.cancelled": {
      if (!event.subscriptionId) return {};
      const subscription = await prisma.subscription.findFirst({
        where: { providerRef: event.subscriptionId },
      });
      await prisma.subscription.updateMany({
        where: { providerRef: event.subscriptionId },
        data: { status: "CANCELLED" },
      });
      return subscription ? { relatedSubscriptionId: subscription.id } : {};
    }
    default:
      return {};
  }
}

export async function recordWebhookEvent(input: {
  provider: string;
  event: VendorWebhookEvent;
  signatureValid: boolean;
}) {
  return prisma.webhookEvent.create({
    data: {
      provider: input.provider,
      eventType: input.event.type,
      payload: input.event as unknown as Prisma.InputJsonValue,
      signatureValid: input.signatureValid,
      status: "RECEIVED",
    },
  });
}

export async function markWebhookProcessed(id: string, result: DispatchResult) {
  return prisma.webhookEvent.update({
    where: { id },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      relatedPaymentIntentId: result.relatedPaymentIntentId,
      relatedSubscriptionId: result.relatedSubscriptionId,
    },
  });
}

export async function markWebhookFailed(id: string, errorMessage: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: "FAILED", errorMessage, processedAt: new Date() },
  });
}

// Re-dispatches a previously RECEIVED/FAILED event against its stored
// payload — the template for this is render/analytics.ts's
// retryDeadLetterJob(): find by id, re-run, log the action.
export async function retryWebhookEvent(webhookEventId: string, adminUserId: string) {
  const row = await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
  if (!row) {
    throw new WebhookEventNotFoundError(`WebhookEvent ${webhookEventId} not found.`);
  }

  const event = row.payload as unknown as VendorWebhookEvent;
  try {
    const result = await dispatchWebhookEvent(event);
    const updated = await markWebhookProcessed(row.id, result);
    await writeAuditLog({
      userId: adminUserId,
      resource: "webhook_event",
      action: "retry",
      detail: { webhookEventId: row.id, eventType: row.eventType },
    });
    return updated;
  } catch (err) {
    await markWebhookFailed(row.id, err instanceof Error ? err.message : "Unknown error");
    throw err;
  }
}

export async function listWebhookEvents(filter?: { status?: "RECEIVED" | "PROCESSED" | "FAILED"; limit?: number }) {
  return prisma.webhookEvent.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { receivedAt: "desc" },
    take: filter?.limit ?? 50,
  });
}
