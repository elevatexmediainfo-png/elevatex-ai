import { prisma } from "@/lib/prisma";
import type { PaymentIntentKind, PaymentIntentStatus } from "@/generated/prisma/enums";

export interface ListPaymentIntentsFilter {
  status?: PaymentIntentStatus;
  kind?: PaymentIntentKind;
  limit?: number;
}

// Admin-only read surface over PaymentIntent — listWebhookEvents()/
// listRefunds() already live in lib/billing/{webhook-log,refunds}.ts since
// they're billing-domain concerns the admin UI just happens to read; this
// file holds only the PaymentIntent listing/detail queries that don't exist
// anywhere else yet.
export async function listPaymentIntents(filter: ListPaymentIntentsFilter = {}) {
  return prisma.paymentIntent.findMany({
    where: {
      status: filter.status,
      kind: filter.kind,
    },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 50,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      refunds: { select: { id: true, amountPaise: true, status: true } },
    },
  });
}

export async function getPaymentIntentDetail(id: string) {
  return prisma.paymentIntent.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      invoice: true,
      refunds: { orderBy: { createdAt: "desc" } },
      disputes: { orderBy: { createdAt: "desc" } },
    },
  });
}
