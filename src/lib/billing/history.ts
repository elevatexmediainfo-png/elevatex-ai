import { prisma } from "@/lib/prisma";

// Credits/page's existing "Activity" list already shows every
// CreditTransaction — this feed is the money side: what was actually paid
// for (PaymentIntent) and what that payment unlocked (Download), merged into
// one chronological list. Pure read, joins data that already exists.

export type BillingHistoryEntry =
  | { kind: "PAYMENT"; id: string; createdAt: Date; status: string; amountPaise: number; description: string }
  | { kind: "DOWNLOAD"; id: string; createdAt: Date; method: string; amountPaidPaise: number | null; creditsSpent: number };

const REFERENCE_LABEL: Record<string, string> = {
  CREDIT_PACKAGE: "Credit package",
  SUBSCRIPTION: "Subscription",
  ONE_TIME_DOWNLOAD: "One-time download",
};

export async function getBillingHistory(userId: string, limit = 50): Promise<BillingHistoryEntry[]> {
  const [payments, downloads] = await Promise.all([
    prisma.paymentIntent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.download.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
  ]);

  const entries: BillingHistoryEntry[] = [
    ...payments.map((p) => ({
      kind: "PAYMENT" as const,
      id: p.id,
      createdAt: p.createdAt,
      status: p.status,
      amountPaise: p.amountPaise,
      description: REFERENCE_LABEL[p.kind] ?? p.kind,
    })),
    ...downloads.map((d) => ({
      kind: "DOWNLOAD" as const,
      id: d.id,
      createdAt: d.createdAt,
      method: d.method,
      amountPaidPaise: d.amountPaidPaise,
      creditsSpent: d.creditsSpent,
    })),
  ];

  return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
