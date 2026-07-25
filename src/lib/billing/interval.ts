import type { BillingInterval } from "@/generated/prisma/enums";

// Milestone 13 — fulfillment.ts and renewSubscription() previously hardcoded
// `setMonth(+1)` in two places, the only renewal math that ever existed.
// BillingInterval was promoted from a free-text "MONTHLY"-only string to a
// real enum specifically so a YEARLY/QUARTERLY/HALF_YEARLY plan renews on
// its own real cadence instead of silently renewing monthly regardless of
// what an admin picked.
export function addBillingInterval(date: Date, interval: BillingInterval): Date {
  const result = new Date(date);
  switch (interval) {
    case "MONTHLY":
      result.setMonth(result.getMonth() + 1);
      break;
    case "QUARTERLY":
      result.setMonth(result.getMonth() + 3);
      break;
    case "HALF_YEARLY":
      result.setMonth(result.getMonth() + 6);
      break;
    case "YEARLY":
      result.setFullYear(result.getFullYear() + 1);
      break;
  }
  return result;
}
