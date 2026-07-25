import type { StrategyField, FieldConfidence } from "../types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "../creative-director/types";
import type { VisualLayoutPlan } from "./types";
import { buildCanvasPlanning }        from "./builders/canvas";
import { buildVisualHierarchy }       from "./builders/hierarchy";
import { buildLayoutBlocks }          from "./builders/blocks";
import { buildGridIntelligence }      from "./builders/grid";
import { buildWhiteSpaceIntelligence } from "./builders/whitespace";
import { buildCompositionPlanning }   from "./builders/composition";
import { buildSafeAreaPlanning }      from "./builders/safe-areas";
import { buildVisualPriorityEngine }  from "./builders/priority";

// Phase 6 — Visual Layout Intelligence Engine.
// Single responsibility: orchestrate all 8 layout-planning builders and
// return a complete VisualLayoutPlan. Pure function — no LLM, no I/O.
//
// STRICT RULES:
//   ✗ Never generates prompts
//   ✗ Never generates copy or typography
//   ✗ Never calls providers
//   ✗ Never generates images or videos
//   ✓ Only decides HOW the layout should be spatially arranged

// ─────────────────────────────────────────────────────────────────────────────
// Confidence score + unknown field helpers
// ─────────────────────────────────────────────────────────────────────────────

function flattenLayoutFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenLayoutFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

function computeLayoutConfidenceScore(domains: Record<string, unknown>): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const fields = Object.values(flattenLayoutFields(domains));
  if (!fields.length) return 0;
  const total = fields.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / fields.length) * 100);
}

function collectLayoutUnknownFields(domains: Record<string, unknown>): string[] {
  return Object.entries(flattenLayoutFields(domains))
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a CreativeStrategy + CampaignPlan into a complete VisualLayoutPlan.
 *  Pure function — no LLM, no I/O, no side effects. */
export function buildVisualLayoutPlan(
  strategy: CreativeStrategy,
  plan: CampaignPlan
): VisualLayoutPlan {
  const canvas         = buildCanvasPlanning(strategy);
  const hierarchy      = buildVisualHierarchy(strategy, plan);
  const blocks         = buildLayoutBlocks(strategy, plan);
  const grid           = buildGridIntelligence(strategy, plan);
  const whiteSpace     = buildWhiteSpaceIntelligence(strategy, plan);
  const composition    = buildCompositionPlanning(strategy, plan);
  const safeAreas      = buildSafeAreaPlanning(strategy);
  const visualPriority = buildVisualPriorityEngine(strategy, plan);

  const domains = { canvas, hierarchy, blocks, grid, whiteSpace, composition, safeAreas, visualPriority };
  const confidenceScore = computeLayoutConfidenceScore(domains);
  const unknownFields = collectLayoutUnknownFields(domains);

  return { ...domains, confidenceScore, unknownFields };
}
