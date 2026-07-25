// Phase 8.8A — Social Proof Engine.
// Generates structured social proof items from industry templates and asset signals.
// Deterministic — no LLM.

import type { SupportedIndustryId, CommercialObjective } from "../commercial-assets/types";
import { INDUSTRY_SOCIAL_PROOF } from "./industry-rules";

// How many social proof items to include based on objective
const PROOF_COUNT_BY_OBJECTIVE: Partial<Record<CommercialObjective, number>> = {
  trust_building: 3,
  brand_awareness: 2,
  lead_generation: 2,
  direct_sale: 1,
  appointment_booking: 2,
};

// Assets that signal specific proof items should be prioritised
const ASSET_PROOF_BOOST: Record<string, number> = {
  google_rating:  0,  // index 0 = rating line
  review_stars:   0,
  award_badge:    4,  // index 4 = award line
  certification:  2,  // index 2 = experience line
};

export function generateSocialProof(
  industry: SupportedIndustryId,
  objective: CommercialObjective,
  mandatoryAssets: string[],
): string[] {
  const pool  = INDUSTRY_SOCIAL_PROOF[industry] ?? INDUSTRY_SOCIAL_PROOF.general;
  const count = PROOF_COUNT_BY_OBJECTIVE[objective] ?? 2;

  // Determine priority indices based on mandatory assets
  const prioritySet = new Set<number>();
  for (const assetId of mandatoryAssets) {
    const idx = ASSET_PROOF_BOOST[assetId];
    if (idx !== undefined && pool[idx] !== undefined) {
      prioritySet.add(idx);
    }
  }

  const ordered: string[] = [];
  const seen = new Set<number>();

  // Priority-boosted items first
  for (const idx of prioritySet) {
    ordered.push(pool[idx]!);
    seen.add(idx);
  }

  // Fill remaining from pool
  for (let i = 0; i < pool.length; i++) {
    if (!seen.has(i)) ordered.push(pool[i]!);
  }

  return ordered.slice(0, count);
}
