import type { StrategyField, FieldConfidence } from "../types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "./types";
import { buildSceneObjective }        from "./builders/scene-objective";
import { buildHeroSubjectPlanning }   from "./builders/hero-subject";
import { buildSupportingSubjectPlanning } from "./builders/supporting-subjects";
import { buildEnvironmentPlanning }   from "./builders/environment";
import { buildObjectPlanning }        from "./builders/objects";
import { buildCompositionPlanning }   from "./builders/composition";
import { buildCameraPlanning }        from "./builders/camera";
import { buildLightingPlanning }      from "./builders/lighting";
import { buildStorytellingPlanning }  from "./builders/storytelling";
import { buildRenderingIntent }       from "./builders/rendering-intent";
import { buildVTEEnrichment }         from "./vte-bridge";

// Phase 10 — Visual Scene Planning Engine.
// Single responsibility: convert UniversalCampaignBlueprint → VisualScenePlan.
// Pure function — no LLM, no I/O, no provider calls.
//
// STRICT RULES:
//   ✗ Never generates prompts or provider instructions
//   ✗ Never generates copy, typography, or layouts
//   ✗ Never calls any AI provider
//   ✓ Only describes WHAT is inside the frame — Art Director level scene brief

function flattenSceneFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenSceneFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

function computeSceneConfidenceScore(domains: Record<string, unknown>): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const fields = Object.values(flattenSceneFields(domains));
  if (!fields.length) return 0;
  const total = fields.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / fields.length) * 100);
}

function collectSceneUnknownFields(domains: Record<string, unknown>): string[] {
  return Object.entries(flattenSceneFields(domains))
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

/** Converts a UniversalCampaignBlueprint into a complete VisualScenePlan.
 *  Pure function — no LLM, no I/O, no side effects. */
export function buildVisualScenePlan(blueprint: UniversalCampaignBlueprint): VisualScenePlan {
  // Phase 10.5A — VTE enrichment computed once, passed to all builders that use it.
  // Priority: Reference Image > Creative Brain > VTE > Knowledge Bank > Fallback.
  const vte = buildVTEEnrichment(blueprint);

  const sceneObjective     = buildSceneObjective(blueprint);
  const heroSubject        = buildHeroSubjectPlanning(blueprint, vte);
  const supportingSubjects = buildSupportingSubjectPlanning(blueprint, vte);
  const environment        = buildEnvironmentPlanning(blueprint, vte);
  const objects            = buildObjectPlanning(blueprint, vte);
  const composition        = buildCompositionPlanning(blueprint);
  const camera             = buildCameraPlanning(blueprint);
  const lighting           = buildLightingPlanning(blueprint, vte);
  const storytelling       = buildStorytellingPlanning(blueprint, vte);
  const renderingIntent    = buildRenderingIntent(blueprint);

  const domains = {
    sceneObjective, heroSubject, supportingSubjects, environment, objects,
    composition, camera, lighting, storytelling, renderingIntent,
  };

  const confidenceScore = computeSceneConfidenceScore(domains);
  const unknownFields   = collectSceneUnknownFields(domains);

  const heroGraph = blueprint.strategy.heroDecision.heroGraph;

  return {
    ...domains,
    ...(heroGraph ? { heroGraph } : {}),
    confidenceScore,
    unknownFields,
  };
}
