// Phase 8 — Typography Director.
//
// Never selects font families. Only defines typography BEHAVIOUR:
//   how much the headline dominates · hierarchy · safe zones
//   CTA emphasis · logo confidence · reading rhythm
//
// Input: Design Director output + Creative Strategy
// Output: TypographyDirectorOutput (pure, deterministic)

import type { CreativeStrategy } from "../creative-brain/types";
import type {
  DesignDirectorOutput,
  TypographyDirectorOutput,
  HeadlineTypography,
  CtaTypography,
  LogoTypography,
  TextAlignment,
  CtaSize,
  CtaContrast,
  LogoVisibility,
  ReadabilityPriority,
  LuxuryLevel,
} from "./types";

// ─── Headline dominance table by luxury level ─────────────────────────────────

interface HeadlineTier {
  dominance: number;      // 1–10
  widthPct:  number;      // frame width %
  maxLines:  number;
  alignment: TextAlignment;
}

const HEADLINE_BY_LUXURY: Record<LuxuryLevel, HeadlineTier> = {
  5: { dominance: 10, widthPct: 70, maxLines: 2, alignment: "left"   },
  4: { dominance:  9, widthPct: 65, maxLines: 3, alignment: "left"   },
  3: { dominance:  8, widthPct: 60, maxLines: 3, alignment: "left"   },
  2: { dominance:  7, widthPct: 55, maxLines: 4, alignment: "left"   },
  1: { dominance:  7, widthPct: 55, maxLines: 4, alignment: "center" },
};

// ─── Headline personality strings ─────────────────────────────────────────────

const HEADLINE_PERSONALITIES: Record<LuxuryLevel, string> = {
  5: "The headline should dominate with restrained luxury — large, elegant, generously tracked, impossible to miss but effortless to read",
  4: "The headline commands nearly a third of the visual composition — premium weight, confident authority",
  3: "The headline leads the composition with clear dominance and professional presence",
  2: "The headline is prominent and immediately readable — direct, clear, purposeful",
  1: "The headline communicates clearly and is impossible to miss at first glance",
};

// ─── CTA derivation from campaign goal ───────────────────────────────────────

function deriveCTASize(campaignGoal: string, urgency: string): CtaSize {
  if (campaignGoal === "lead_generation" || campaignGoal === "sales") return "large";
  if (urgency === "high" || urgency === "immediate") return "dominant";
  if (campaignGoal === "awareness" || campaignGoal === "trust") return "medium";
  return "medium";
}

function deriveCTAContrast(campaignGoal: string, urgency: string): CtaContrast {
  if (urgency === "immediate" || urgency === "high") return "maximum";
  if (campaignGoal === "lead_generation" || campaignGoal === "sales") return "high";
  return "standard";
}

function deriveCTADominance(campaignGoal: string): number {
  if (campaignGoal === "lead_generation") return 9;
  if (campaignGoal === "sales")           return 9;
  if (campaignGoal === "engagement")      return 8;
  if (campaignGoal === "awareness")       return 7;
  return 7;
}

// ─── Logo visibility by luxury level ─────────────────────────────────────────
// Premium luxury brands use confident restraint — small is exclusive.
// Mass market needs the brand seen prominently.

function deriveLogoVisibility(luxury: LuxuryLevel, businessType: string): LogoVisibility {
  // Premium luxury: logo is small and confident (exclusivity through restraint)
  if (luxury >= 5) return "subtle";
  if (luxury >= 4) return "medium";
  // Local/mass market businesses: logo needs to be seen
  if (businessType === "local_service" || businessType === "mass_market") return "prominent";
  return "medium";
}

// ─── Safe zone position strings ───────────────────────────────────────────────

function deriveHeadlineSafeZone(design: DesignDirectorOutput): string {
  const top = design.negativeSpace.top;
  return `upper ${top} of the composition — reserved, uninterrupted, no visual intrusion from the hero below`;
}

function deriveCTASafeZone(design: DesignDirectorOutput): string {
  const bottom = design.negativeSpace.bottom;
  return `bottom ${bottom} — clean horizontal band, no competing visual elements`;
}

function deriveLogoSafeZone(design: DesignDirectorOutput): string {
  const right = design.negativeSpace.right;
  return `lower-right corner, ${right} margin from edge — brand mark sits with confidence, never shouts`;
}

// ─── Spacing and readability ──────────────────────────────────────────────────

function deriveReadability(luxury: LuxuryLevel): ReadabilityPriority {
  if (luxury >= 4) return "maximum";
  if (luxury >= 2) return "high";
  return "balanced";
}

function deriveSpacingBehavior(luxury: LuxuryLevel): string {
  switch (luxury) {
    case 5:
      return "Generous tracking on the headline — letters breathe. Maximum line height. Significant spacing between CTA and logo. Typography is never crowded.";
    case 4:
      return "Comfortable tracking and line height. Headline breathes above and below. CTA has clear visual separation from surrounding elements.";
    case 3:
      return "Standard generous spacing. Clear visual hierarchy through size, not crowding.";
    default:
      return "Clear hierarchy through size and weight. Elements have defined spacing — no collisions.";
  }
}

function deriveTypographyPersonality(luxury: LuxuryLevel, communicationStyle: string): string {
  const styleMap: Record<string, string> = {
    luxury:        "Luxury Editorial — typeface personality is confident, unhurried, elegant",
    premium:       "Premium Professional — strong, sophisticated, authoritative",
    professional:  "Professional Authority — clear, trustworthy, commanding",
    friendly:      "Warm Authority — approachable but never weak",
    minimal:       "Editorial Minimal — less is more, every character earns its place",
    emotional:     "Emotional Editorial — typography serves the feeling first",
    educational:   "Clear Academic — readable before elegant",
    authority:     "Authority Voice — bold, credible, impossible to doubt",
  };

  const basePersonality = styleMap[communicationStyle] ?? "Premium Editorial";

  if (luxury >= 5) return `Ultra-Luxury: ${basePersonality}. Large, tracked, restrained.`;
  if (luxury >= 4) return `High-Premium: ${basePersonality}. Confident and clean.`;
  return basePersonality;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function buildTypographyDirectorOutput(
  design: DesignDirectorOutput,
  strategy: CreativeStrategy,
): TypographyDirectorOutput {
  const luxury        = design.luxuryLevel;
  const campaignGoal  = strategy.marketing.campaignGoal.value ?? "";
  const urgency       = strategy.communication.urgency.value ?? "";
  const businessType  = strategy.business.businessType.value ?? "";
  const commStyle     = strategy.communication.communicationStyle.value ?? "";

  const tier = HEADLINE_BY_LUXURY[luxury];

  const headline: HeadlineTypography = {
    dominance:   tier.dominance,
    width:       `${tier.widthPct}% of frame width`,
    maxLines:    tier.maxLines,
    alignment:   tier.alignment,
    personality: HEADLINE_PERSONALITIES[luxury],
    safeZone:    deriveHeadlineSafeZone(design),
  };

  const cta: CtaTypography = {
    dominance: deriveCTADominance(campaignGoal),
    size:      deriveCTASize(campaignGoal, urgency),
    contrast:  deriveCTAContrast(campaignGoal, urgency),
    position:  `bottom ${design.negativeSpace.bottom} of frame, centered or left-aligned`,
    safeZone:  deriveCTASafeZone(design),
  };

  const logo: LogoTypography = {
    visibility: deriveLogoVisibility(luxury, businessType),
    position:   `lower-right, ${design.negativeSpace.right} from right edge`,
    safeZone:   deriveLogoSafeZone(design),
  };

  return {
    headline,
    cta,
    logo,
    readabilityPriority:   deriveReadability(luxury),
    typographyPersonality: deriveTypographyPersonality(luxury, commStyle),
    spacingBehavior:       deriveSpacingBehavior(luxury),
  };
}
