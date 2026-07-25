import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Milestone 12 — generalizes ProviderAuditLog's existing shape (resource,
// action, performedBy, detail — names/ids only, never secret values) beyond
// just provider-config changes: credit grants, coupon redemptions,
// subscription cancellations, account suspension, broadcast sends, manual
// dead-letter retries. Same pattern, more call sites — not a second
// audit mechanism alongside ProviderAuditLog, which keeps its own table
// since it's specifically scoped to (category, providerId).

export interface WriteAuditLogInput {
  userId?: string | null;
  resource: string;
  action: string;
  detail?: Record<string, unknown>;
}

type Db = Prisma.TransactionClient | typeof prisma;

// Never throws — an audit-log write failing should not fail the action it's
// describing. Best-effort, same posture as the notification dispatch in
// lib/notifications/.
export async function writeAuditLog(input: WriteAuditLogInput, db: Db = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        resource: input.resource,
        action: input.action,
        detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[audit-log] write failed", input.resource, input.action, err);
  }
}

export async function listAuditLogs(limit = 100, resource?: string) {
  return prisma.auditLog.findMany({
    where: resource ? { resource } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
