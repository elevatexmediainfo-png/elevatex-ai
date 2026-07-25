import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "../scene-planner/types";
import type { SceneGraph } from "../scene-graph/types";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { PromptSpecification } from "./types";
import { buildGPTNarrativeSection } from "./gpt-narrative";
import { buildGenerationMission }     from "./builders/mission";
import { buildHeroSpecification }     from "./builders/hero";
import { buildSupportingElements }    from "./builders/supporting";
import { buildCompositionSpec }       from "./builders/composition";
import { buildCameraSpec }            from "./builders/camera";
import { buildLightingSpec }          from "./builders/lighting";
import { buildEnvironmentSpec }       from "./builders/environment";
import { buildMarketingContext }      from "./builders/marketing";
import { buildTypographyZones }       from "./builders/typography";
import { buildBrandRules }            from "./builders/brand-rules";
import { buildNegativeConstraints }   from "./builders/negative-constraints";
import { buildRenderingSpec }         from "./builders/rendering";
import {
  PROMPT_SPEC_VERSION,
  generateSpecId,
  computeSpecConfidenceScore,
  collectSpecUnknownFields,
  generateSpecWarnings,
  determineSpecValidation,
} from "./versioning";
import { resolveAdvertisementNarrative } from "../advertisement-intelligence/engine";

// Phase 11 — Prompt Specification Engine.
// Single responsibility: combine UniversalCampaignBlueprint + VisualScenePlan
// into one structured PromptSpecification that every Provider Translator reads.
// Pure function — no LLM, no I/O, no side effects.
//
// STRICT RULES:
//   ✗ Never generates provider prompts (OpenAI/Gemini/Flux/Ideogram)
//   ✗ Never uses provider-specific API parameters
//   ✗ Never generates copy, typography, or layouts
//   ✗ Never calls any AI provider
//   ✓ Only assembles a structured, provider-agnostic specification
//
// Phase 10.6C — Runtime Integration: optional trailing `sceneGraph` parameter.
// When provided, it becomes the single source of truth for camera/pose/
// materials/background/interaction/environment content that Scene Graph
// itself computes — the five affected builders (hero, supporting, composition,
// camera, environment) prefer it over independently re-deriving the same
// information from VisualScenePlan. Every existing call site that omits this
// parameter continues to behave exactly as before it existed.

export function buildPromptSpecification(
  blueprint: UniversalCampaignBlueprint,
  scene: VisualScenePlan,
  gptDirection?: GPTCampaignDirection,
  sceneGraph?: SceneGraph
): PromptSpecification {
  const mission             = buildGenerationMission(blueprint, scene);
  const hero                = buildHeroSpecification(scene, sceneGraph);
  const supporting          = buildSupportingElements(scene, blueprint, sceneGraph);
  const composition         = buildCompositionSpec(scene, blueprint, sceneGraph);
  const camera              = buildCameraSpec(scene, sceneGraph);
  const lighting            = buildLightingSpec(scene, blueprint);
  const environment         = buildEnvironmentSpec(scene, sceneGraph);
  const marketing           = buildMarketingContext(blueprint, scene);
  const typography          = buildTypographyZones(blueprint);
  const brandRules          = buildBrandRules(blueprint);
  const negativeConstraints = buildNegativeConstraints(blueprint, scene);
  const rendering           = buildRenderingSpec(scene, blueprint);

  const sections = { mission, hero, supporting, composition, camera, lighting, environment, marketing, typography, brandRules, negativeConstraints, rendering };

  const confidenceScore    = computeSpecConfidenceScore(sections);
  const unknownFields      = collectSpecUnknownFields(sections);
  const warnings           = generateSpecWarnings(sections);
  const validationStatus   = determineSpecValidation(confidenceScore, warnings);

  const heroGraph = blueprint.strategy.heroDecision.heroGraph;
  const meta = {
    specId:             generateSpecId(),
    createdAt:          new Date().toISOString(),
    schemaVersion:      PROMPT_SPEC_VERSION,
    sourceBlueprintId:  blueprint.meta.blueprintId,
    confidenceScore,
    validationStatus,
    warnings,
    ...(heroGraph ? { heroGraph } : {}),
  };

  // Phase 10.4J — Advertisement Intelligence: convert marketing signals → visual storytelling
  const advertisementNarrative = resolveAdvertisementNarrative(blueprint.strategy, scene);

  // Phase 8.2: pass blueprint.strategy so buildGPTNarrativeSection() can invoke
  // the Design Intelligence Layer when ENABLE_DESIGN_INTELLIGENCE_LAYER=true.
  const gptNarrative = gptDirection
    ? buildGPTNarrativeSection(gptDirection, blueprint.strategy)
    : undefined;

  return {
    meta,
    advertisementNarrative,
    ...sections,
    unknownFields,
    ...(gptNarrative ? { gptNarrative } : {}),
  };
}
