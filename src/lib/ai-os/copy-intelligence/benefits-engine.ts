// Phase 8.8A — Benefits Engine.
// Generates concise benefit bullets (≤ 6 words each).
// Deterministic — no LLM.

import type { SupportedIndustryId, CommercialObjective, BrandType } from "../commercial-assets/types";
import { INDUSTRY_BENEFITS } from "./industry-rules";

// Objective-driven benefit index overrides (pick these items first from the pool)
const OBJECTIVE_PRIORITY_INDEX: Partial<Record<CommercialObjective, number[]>> = {
  lead_generation:     [0, 1, 2],
  trust_building:      [2, 3, 6],
  direct_sale:         [0, 1, 4],
  appointment_booking: [1, 2, 0],
  brand_awareness:     [0, 1, 2, 3],
  footfall:            [0, 3, 6],
  event_attendance:    [0, 1, 2],
  product_launch:      [0, 2, 4],
};

// Luxury brands hide price/EMI benefits
const LUXURY_SUPPRESS_INDICES = new Set([4]); // EMI/Affordable options

export function generateBenefits(
  industry: SupportedIndustryId,
  objective: CommercialObjective,
  brandType: BrandType,
  maxCount = 4,
): string[] {
  const pool = INDUSTRY_BENEFITS[industry] ?? INDUSTRY_BENEFITS.general;
  const priorityOrder = OBJECTIVE_PRIORITY_INDEX[objective] ?? [0, 1, 2, 3];

  const isLuxury = brandType === "luxury" || brandType === "premium";

  // Build ordered list: priority indices first, then remaining
  const ordered: string[] = [];
  const seen = new Set<number>();

  for (const idx of priorityOrder) {
    if (isLuxury && LUXURY_SUPPRESS_INDICES.has(idx)) continue;
    if (pool[idx] !== undefined) {
      ordered.push(pool[idx]!);
      seen.add(idx);
    }
  }

  for (let i = 0; i < pool.length; i++) {
    if (!seen.has(i)) {
      if (isLuxury && LUXURY_SUPPRESS_INDICES.has(i)) continue;
      ordered.push(pool[i]!);
    }
  }

  return ordered.slice(0, maxCount);
}
