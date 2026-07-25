import type { StrategyField, FieldConfidence } from "../types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "../creative-director/types";
import type { VisualLayoutPlan } from "../visual-layout/types";
import type { TypographyPlan } from "./types";
import { buildTypographyHierarchy }  from "./builders/hierarchy";
import { buildFontIntelligence }     from "./builders/font-intelligence";
import { buildFontWeightPlanning }   from "./builders/font-weight";
import { buildTextAlignment }        from "./builders/alignment";
import { buildReadabilityIntelligence } from "./builders/readability";
import { buildInformationPriority }  from "./builders/information-priority";
import { buildTextSafeAreas }        from "./builders/text-safe-areas";
import { buildTypographyRhythm }     from "./builders/rhythm";

// Phase 8 — Typography & Design System Intelligence Engine.
// Single responsibility: orchestrate all 8 typography builders and return
// a complete TypographyPlan. Pure function — no LLM, no I/O.
//
// STRICT RULES:
//   ✗ Never names an actual font family
//   ✗ Never specifies pixel sizes
//   ✗ Never generates layouts, prompts, colors, or images
//   ✓ Only defines typographic CHARACTER and INTELLIGENCE

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function flattenTypographyFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenTypographyFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

function computeTypographyConfidenceScore(domains: Record<string, unknown>): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const fields = Object.values(flattenTypographyFields(domains));
  if (!fields.length) return 0;
  const total = fields.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / fields.length) * 100);
}

function collectTypographyUnknownFields(domains: Record<string, unknown>): string[] {
  return Object.entries(flattenTypographyFields(domains))
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a CreativeStrategy + CampaignPlan + VisualLayoutPlan into a
 *  complete TypographyPlan. CopywritingPlan (Phase 7, not yet built) will be
 *  added to the signature when available. Pure function — no LLM, no I/O. */
export function buildTypographyPlan(
  strategy: CreativeStrategy,
  plan: CampaignPlan,
  layout: VisualLayoutPlan
  // copywritingPlan is intentionally omitted from the signature until Phase 7.
  // The function signature will be extended when CopywritingPlan is built.
): TypographyPlan {
  const hierarchy           = buildTypographyHierarchy(strategy, plan, layout);
  const fontIntelligence    = buildFontIntelligence(strategy, plan);
  const fontWeights         = buildFontWeightPlanning(strategy, plan);
  const alignment           = buildTextAlignment(strategy, plan, layout);
  const readability         = buildReadabilityIntelligence(strategy, layout);
  const informationPriority = buildInformationPriority(strategy, plan, layout);
  const textSafeAreas       = buildTextSafeAreas(layout);
  const rhythm              = buildTypographyRhythm(strategy, plan, layout);

  const domains = { hierarchy, fontIntelligence, fontWeights, alignment, readability, informationPriority, textSafeAreas, rhythm };
  const confidenceScore = computeTypographyConfidenceScore(domains);
  const unknownFields = collectTypographyUnknownFields(domains);

  return { ...domains, confidenceScore, unknownFields };
}
