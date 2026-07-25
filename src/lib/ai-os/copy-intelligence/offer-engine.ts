// Phase 8.8A — Offer Engine.
// Formats offer copy for commercial overlays. Luxury brands suppress discount language.
// Deterministic — no LLM.

import type { BrandType, CommercialObjective } from "../commercial-assets/types";
import { OBJECTIVE_BADGE, CATEGORY_BADGE } from "./industry-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Luxury reformatter — replaces heavy discount phrasing
// ─────────────────────────────────────────────────────────────────────────────

const LUXURY_OFFER_REPLACEMENTS: [RegExp, string][] = [
  [/\b(\d+)\s*%\s*off\b/i,       "Exclusive Member Privilege"],
  [/\bflat\s+\d+%\b/i,           "Exclusive Privilege Offer"],
  [/\bfree\b/i,                   "Complimentary"],
  [/\bdiscount\b/i,               "Special Privilege"],
  [/\bsale\b/i,                   "Private Preview"],
  [/\bcheap\b/i,                  "Value Collection"],
];

function luxuryRephrase(offer: string): string {
  for (const [pattern, replacement] of LUXURY_OFFER_REPLACEMENTS) {
    if (pattern.test(offer)) return replacement;
  }
  return offer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function generateOfferCopy(
  offer: string | null,
  brandType: BrandType,
): string | null {
  if (!offer) return null;

  const isLuxuryBrand = brandType === "luxury" || brandType === "premium";

  if (isLuxuryBrand) {
    return luxuryRephrase(offer);
  }

  // Ensure it starts with a capital
  return offer.charAt(0).toUpperCase() + offer.slice(1);
}

export function generateBadge(
  offer: string | null,
  campaignCategory: string,
  objective: CommercialObjective,
  brandType: BrandType,
): string | null {
  const isLuxury = brandType === "luxury";

  // Luxury never shows badges for discounts
  if (isLuxury && offer) return null;

  // Category-specific badge
  const catBadge = CATEGORY_BADGE[campaignCategory];
  if (catBadge) return catBadge;

  // Objective-specific badge
  const objBadge = OBJECTIVE_BADGE[objective];
  if (objBadge) return objBadge;

  // If offer is present, default badge
  if (offer) return "Limited Offer";

  return null;
}
