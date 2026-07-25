// Phase 8.8A — Copy Intelligence Engine.
// Orchestrates all copy sub-engines into a single CommercialCopy output.
// Deterministic — no LLM, no randomness, no layout decisions.

import type { CreativeStrategy }       from "../creative-brain/types";
import type { CommercialAssetPlan }    from "../commercial-assets/types";
import type { CommercialCopy, CopyInput, CopyMetadata } from "./types";
import { strategyToAssetPlannerInput, normalizeIndustryId } from "../commercial-assets/adapter";
import { deriveTone }      from "./tone-engine";
import { generateHeadline } from "./headline-engine";
import { generateCTA }     from "./cta-engine";
import { generateBenefits } from "./benefits-engine";
import { generateSocialProof } from "./social-proof-engine";
import { generateOfferCopy, generateBadge } from "./offer-engine";
import { getDisclaimer }   from "./disclaimer-engine";
import {
  INDUSTRY_DEFAULT_SUBHEADLINES,
  CATEGORY_BADGE,
} from "./industry-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Subheadline generation
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function generateSubheadline(input: CopyInput): string | null {
  const lower = input.rawIdea.toLowerCase();
  const cat   = input.campaignCategory.toLowerCase();

  // Grand opening / launch signals
  const isLaunch = cat === "launch" || cat === "grand_opening" ||
    lower.includes("grand opening") || lower.includes("opening") || lower.includes("inaugurate");

  if (isLaunch) {
    if (lower.includes("weekend"))          return "Grand Opening This Weekend";
    if (lower.includes("today"))            return "Grand Opening Today";
    const month = MONTHS.find((m) => lower.includes(m.toLowerCase()));
    if (month) return `Grand Opening — ${month}`;
    return "Grand Opening Soon";
  }

  // Offer / promotion
  if (cat === "offer" || cat === "promotion" || cat === "festival") {
    if (input.offer) return `${input.offer} — Limited Time`;
    if (cat === "festival") return "Festive Season Special";
    return "Limited Time Offer";
  }

  // Event attendance
  if (input.commercialObjective === "event_attendance") {
    return "Seats Filling Fast — Register Now";
  }

  // Objective-based fallback
  switch (input.commercialObjective) {
    case "lead_generation":     return "Free Consultation Available";
    case "trust_building":      return "Trusted by Thousands";
    case "direct_sale":         return input.offer ? `${input.offer} — Today Only` : "Shop Now & Save";
    case "product_launch":      return "Now Available";
    case "appointment_booking": return "Book Your Slot Today";
    default:                    return INDUSTRY_DEFAULT_SUBHEADLINES[input.industry] ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build metadata
// ─────────────────────────────────────────────────────────────────────────────

function buildMetadata(
  input: CopyInput,
  headline: string,
  benefits: string[],
  disclaimer: string | null,
): CopyMetadata {
  return {
    industry:        input.industry,
    objective:       input.commercialObjective,
    brandType:       input.brandType,
    headlineWordCount: headline.split(/\s+/).filter(Boolean).length,
    benefitCount:    benefits.length,
    hasOffer:        input.offer !== null,
    hasDisclaimer:   disclaimer !== null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter: CreativeStrategy → CopyInput
// ─────────────────────────────────────────────────────────────────────────────

export function strategyToCopyInput(
  strategy:         CreativeStrategy,
  rawIdea:          string,
  commercialAssets: CommercialAssetPlan,
): CopyInput {
  const assetInput = strategyToAssetPlannerInput(strategy);

  return {
    rawIdea,
    industry:            assetInput.industry,
    campaignCategory:    strategy.campaign.campaignCategory.value === "unknown"
                           ? "general"
                           : (strategy.campaign.campaignCategory.value ?? "general"),
    audience:            strategy.audience.primaryAudience.value === "unknown"
                           ? "general"
                           : (strategy.audience.primaryAudience.value ?? "general"),
    commercialObjective: assetInput.commercialObjective,
    brandType:           assetInput.brandType,
    communicationStyle:  strategy.communication.communicationStyle.value ?? "professional",
    offer:               strategy.business.offerDetails.offerValue ?? null,
    mandatoryAssets:     commercialAssets.mandatory,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine
// ─────────────────────────────────────────────────────────────────────────────

export function generateCommercialCopy(input: CopyInput): CommercialCopy {
  // 1. Derive tone
  const tone = deriveTone(
    input.communicationStyle,
    null,                    // luxuryLevel is encoded in brandType
    input.brandType,
    input.industry,
  );

  // 2. Headline
  const headlineResult = generateHeadline(input, tone);

  // 3. Subheadline
  const subheadline = generateSubheadline(input);

  // 4. CTA
  const { primary: cta, secondary: secondaryCta } = generateCTA(
    input.industry,
    input.commercialObjective,
  );

  // 5. Benefits
  const benefits = generateBenefits(
    input.industry,
    input.commercialObjective,
    input.brandType,
  );

  // 6. Social proof
  const socialProof = generateSocialProof(
    input.industry,
    input.commercialObjective,
    input.mandatoryAssets,
  );

  // 7. Offer
  const offer = generateOfferCopy(input.offer, input.brandType);

  // 8. Badge
  const badge = generateBadge(
    input.offer,
    input.campaignCategory,
    input.commercialObjective,
    input.brandType,
  );

  // 9. Disclaimer
  const disclaimer = getDisclaimer(input.industry);

  // 10. Metadata
  const metadata = buildMetadata(input, headlineResult.best, benefits, disclaimer);

  return {
    headline:           headlineResult.best,
    subheadline,
    benefits,
    cta,
    secondaryCta,
    socialProof,
    offer,
    badge,
    disclaimer,
    alternateHeadlines: headlineResult.alternates,
    tone,
    metadata,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: build from blueprint inputs (used by blueprint builder)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCopyFromBlueprintInputs(
  strategy:         CreativeStrategy,
  commercialAssets: CommercialAssetPlan,
  rawIdea:          string,
): CommercialCopy {
  const input = strategyToCopyInput(strategy, rawIdea, commercialAssets);
  return generateCommercialCopy(input);
}
