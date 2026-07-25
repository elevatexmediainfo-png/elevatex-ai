// Phase 8.8A — CTA Engine.
// Generates primary and secondary CTA based on industry and objective.
// Deterministic lookup — no LLM.

import type { SupportedIndustryId, CommercialObjective } from "../commercial-assets/types";
import { INDUSTRY_CTA, INDUSTRY_SECONDARY_CTA } from "./industry-rules";

export function generateCTA(
  industry: SupportedIndustryId,
  objective: CommercialObjective,
): { primary: string; secondary: string | null } {
  const ctaMap = INDUSTRY_CTA[industry] ?? INDUSTRY_CTA.general;
  const primary = ctaMap[objective] ?? ctaMap.default ?? "Learn More";

  const secondaryMap = INDUSTRY_SECONDARY_CTA[industry];
  const secondary = secondaryMap?.[objective] ?? null;

  return { primary, secondary };
}
