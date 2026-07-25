import type { StrategyField, FieldConfidence } from "../types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "./types";
import { buildCampaignConcept }          from "./builders/concept";
import { buildVisualStory }              from "./builders/visual-story";
import { buildInformationArchitecture }  from "./builders/info-architecture";
import { buildAdvertisementStructure }   from "./builders/ad-structure";
import { buildVisualDirection }          from "./builders/visual-direction";
import { buildPhotographyDirection }     from "./builders/photo-direction";
import { buildDesignDirection }          from "./builders/design-direction";
import { buildMarketingStructure }       from "./builders/marketing-structure";
import { buildCreativeConstraints }      from "./builders/creative-constraints";

// Phase 5 — Creative Director Engine.
// Single responsibility: orchestrate all 9 campaign-planning builders and
// return a complete CampaignPlan. Pure function — no LLM, no I/O, no DB.
//
// STRICT RULES (verified):
//   ✗ Never generates prompts
//   ✗ Never generates headlines / CTA / body copy
//   ✗ Never generates typography, fonts, colors, grids, or layouts
//   ✗ Never calls providers or databases
//   ✓ Only designs the campaign — what and why, never how

// ─────────────────────────────────────────────────────────────────────────────
// Confidence score + unknown field helpers
// ─────────────────────────────────────────────────────────────────────────────

function flattenCampaignFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenCampaignFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

function computeCampaignConfidenceScore(domains: Record<string, unknown>): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const fields = Object.values(flattenCampaignFields(domains));
  if (!fields.length) return 0;
  const total = fields.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / fields.length) * 100);
}

function collectCampaignUnknownFields(domains: Record<string, unknown>): string[] {
  return Object.entries(flattenCampaignFields(domains))
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a CreativeStrategy into a complete CampaignPlan.
 *  Every builder is isolated to its single responsibility. Pure function. */
export function buildCampaignPlan(strategy: CreativeStrategy): CampaignPlan {
  const concept                 = buildCampaignConcept(strategy);
  const visualStory             = buildVisualStory(strategy);
  const informationArchitecture = buildInformationArchitecture(strategy);
  const advertisementStructure  = buildAdvertisementStructure(strategy, concept);
  const visualDirection         = buildVisualDirection(strategy);
  const photographyDirection    = buildPhotographyDirection(strategy);
  const designDirection         = buildDesignDirection(strategy);
  const marketingStructure      = buildMarketingStructure(strategy);
  const creativeConstraints     = buildCreativeConstraints(strategy);

  const domains = {
    concept, visualStory, informationArchitecture, advertisementStructure,
    visualDirection, photographyDirection, designDirection, marketingStructure, creativeConstraints,
  };

  const confidenceScore = computeCampaignConfidenceScore(domains);
  const unknownFields = collectCampaignUnknownFields(domains);

  return { ...domains, confidenceScore, unknownFields };
}
