import { prisma } from "@/lib/prisma";

// Pay Per Download (one-time purchase of a single video's master download,
// no credits/subscription involved) reuses the same PricingPlan row the
// admin panel already exposes for editing (seeded as "Pay Per Download",
// billingModel PAY_PER_DOWNLOAD) rather than introducing a parallel pricing
// concept just for this flow.

export class PayPerDownloadNotConfiguredError extends Error {}

/** Throws if a price hasn't actually been set — a 0-paise plan is the seeded
 *  default, not a real "this download is free" decision an admin made. */
export function assertPurchasablePrice(priceInPaise: number): void {
  if (priceInPaise <= 0) {
    throw new PayPerDownloadNotConfiguredError(
      "One-time downloads aren't configured yet — set a price on the Pay Per Download plan in /admin/pricing."
    );
  }
}

export async function findActivePayPerDownloadPlan() {
  return prisma.pricingPlan.findFirst({
    where: { billingModel: "PAY_PER_DOWNLOAD", isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}
