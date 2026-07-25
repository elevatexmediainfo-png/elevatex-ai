import { getConfig } from "@/lib/admin/config";
import type { GenerationUsage } from "./types";

export type CostUnit = "PER_CALL" | "PER_1K_TOKENS" | "PER_1K_CHARS" | "PER_SECOND" | "PER_IMAGE";

export interface CostRate {
  unit: CostUnit;
  rate: number;
}

// Pure — the rate table is passed in, not read from the DB — so the unit
// math is independently testable. `estimateCost` below is the thin
// admin-config-backed wrapper production code calls.
export function computeCost(rate: CostRate | undefined, usage: GenerationUsage | undefined): number {
  if (!rate || rate.rate <= 0) return 0;
  switch (rate.unit) {
    case "PER_CALL":
      return rate.rate;
    case "PER_1K_TOKENS":
      return rate.rate * ((usage?.tokens ?? 0) / 1000);
    case "PER_1K_CHARS":
      return rate.rate * ((usage?.characters ?? 0) / 1000);
    case "PER_SECOND":
      return rate.rate * (usage?.seconds ?? 0);
    case "PER_IMAGE":
      return rate.rate * (usage?.images ?? 1);
    default:
      return 0;
  }
}

// Vendor cost tracking (USD), not user-facing pricing — distinct from
// PricingPlan/CreditPackage, which are what the user is actually charged.
// Rates are admin-configurable (GENERATION_COST_RATES) rather than
// hardcoded, same as every other provider-adjacent number in this app.
export async function estimateCost(providerId: string, usage: GenerationUsage | undefined): Promise<number> {
  const rates = await getConfig("GENERATION_COST_RATES");
  return computeCost(rates[providerId], usage);
}
