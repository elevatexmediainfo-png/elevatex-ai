import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/providers/payment";
import { writeAuditLog } from "@/lib/admin/audit-log";

export class RefundError extends Error {}

export interface CreateRefundInput {
  paymentIntentId: string;
  amountPaise: number;
  reason?: string;
  adminUserId: string;
}

// Milestone 13 — the only path that should ever create a Refund row. Writes
// the row before calling the provider (so a crash mid-call still leaves a
// PENDING record to investigate, never a silent vendor-side refund with
// nothing on our side), then updates it to PROCESSED/FAILED based on the
// actual provider response.
export async function createRefund(input: CreateRefundInput) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: input.paymentIntentId } });
  if (!intent) {
    throw new RefundError(`PaymentIntent ${input.paymentIntentId} not found.`);
  }
  if (intent.status !== "PAID") {
    throw new RefundError(`PaymentIntent is ${intent.status}, not PAID — nothing to refund.`);
  }
  if (!intent.providerPaymentId) {
    throw new RefundError("PaymentIntent has no provider payment id — cannot refund.");
  }

  const refundRow = await prisma.refund.create({
    data: {
      paymentIntentId: intent.id,
      amountPaise: input.amountPaise,
      reason: input.reason,
      initiatedBy: input.adminUserId,
      status: "PENDING",
    },
  });

  try {
    const provider = await getPaymentProvider();
    const result = await provider.refund({
      providerPaymentId: intent.providerPaymentId,
      amountPaise: input.amountPaise,
      reason: input.reason,
    });

    const updated = await prisma.refund.update({
      where: { id: refundRow.id },
      data: {
        status: result.status,
        providerRefundId: result.providerRefundId,
        processedAt: new Date(),
      },
    });

    await writeAuditLog({
      userId: input.adminUserId,
      resource: "payment_intent",
      action: "refund",
      detail: { paymentIntentId: intent.id, amountPaise: input.amountPaise, status: result.status },
    });

    return updated;
  } catch (err) {
    await prisma.refund.update({ where: { id: refundRow.id }, data: { status: "FAILED" } });
    throw err;
  }
}

export async function listRefunds(filter?: { paymentIntentId?: string }) {
  return prisma.refund.findMany({
    where: filter?.paymentIntentId ? { paymentIntentId: filter.paymentIntentId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { paymentIntent: { select: { id: true, userId: true, kind: true, amountPaise: true } } },
  });
}
