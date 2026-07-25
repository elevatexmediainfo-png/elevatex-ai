import type { StrategyField } from "../types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "../scene-planner/types";
import type { SceneIndustry } from "../prompt-spec/scene-builder";
import type { SceneGraph } from "./types";
import { baseSeed } from "./seed";
import { getKnowledgeSignal } from "./knowledge-bridge";
import { buildWhoGraph } from "./builders/who";
import { buildWhereGraph } from "./builders/where";
import { buildPoseGraph } from "./builders/pose";
import { buildBodyGraph } from "./builders/body";
import { buildObjectContactGraph } from "./builders/object-contact";
import { buildMaterialsGraph } from "./builders/materials";
import { buildMicroMotionGraph } from "./builders/micro-motion";
import { buildCameraGraph } from "./builders/camera";
import { renderNarrative } from "./narrative";

// Phase 10.6B — Dynamic Scene Graph Compiler.
//
// Pipeline position:
//   Creative Brain -> Scene Planner -> SCENE GRAPH COMPILER -> Prompt Visual
//   Compiler (Phase 10.6A) -> Provider Translator.
//
// The Phase 10.5C Scene Graph audit measured the live pipeline's output at
// 64.5/100 photographic completeness, naming ten structurally absent
// dimensions (body orientation, head direction, eye direction, hand
// position, object contact, subject count, architecture, occlusion, micro
// motion, temporal instant). buildSceneGraph() converts a
// UniversalCampaignBlueprint + VisualScenePlan — which already answer WHAT
// the campaign wants and WHY — into exactly what a camera would physically
// record at one instant: who, where, pose, body, contact, micro-motion,
// camera, and materials, every leaf populated, nothing left as an
// unaddressed gap.
//
// Pure function — no LLM, no I/O, no side effects, fully deterministic:
// the same blueprint + scene always produce the same graph. Builders never
// invent facts that already exist upstream (Hero Fusion's spine, VTE
// primitives, VisualScenePlan's camera/composition/lighting signals) — they
// only fill the physical dimensions nothing upstream computes yet, and every
// one of those fills is assembled from small independent vocabulary axes
// (seed.ts's axisSeed) rather than a single per-cell lookup table.

const HERO_POSE_TO_ARCHETYPE: Record<string, string> = {
  seated_engaged:       "authority",
  standing_confident:   "authority",
  mid_action:           "moment",
  at_rest:              "emotion",
  dynamic_movement:     "moment",
  static_product:       "product",
  transformation_split: "transformation",
  overhead_product:     "product",
  unknown:              "moment",
};

function resolveIndustry(bp: UniversalCampaignBlueprint): SceneIndustry {
  const sub = bp.strategy.business.subIndustry.value;
  const main = bp.strategy.business.industry.value;
  const raw = sub !== "unknown" ? sub : main;
  const KNOWN: readonly string[] = ["restaurant", "dental", "salon", "jewellery", "hospital", "interior", "real-estate", "furniture", "school", "retail", "generic"];
  return (KNOWN.includes(raw) ? raw : "generic") as SceneIndustry;
}

function flattenFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

/**
 * 0-100 photographic completeness: the share of leaf fields that carry a
 * concrete answer. "not_applicable" counts as complete (a confident, correct
 * absence — an animal-free scene is not a gap); only "unknown" counts against
 * the score. This is the same checklist shape the Phase 10.5C audit used, now
 * measured against the Scene Graph's own output instead of the Provider Prompt.
 */
function computeCompleteness(domains: Record<string, unknown>): { score: number; unknownFields: string[] } {
  const fields = flattenFields(domains);
  const entries = Object.entries(fields);
  if (entries.length === 0) return { score: 0, unknownFields: [] };
  const unknownFields = entries.filter(([, f]) => f.value === "unknown").map(([k]) => k);
  const score = Math.round(((entries.length - unknownFields.length) / entries.length) * 100);
  return { score, unknownFields };
}

/** Converts a UniversalCampaignBlueprint + VisualScenePlan into a complete SceneGraph.
 *  Pure function — no LLM, no I/O, no side effects. */
export function buildSceneGraph(blueprint: UniversalCampaignBlueprint, scene: VisualScenePlan): SceneGraph {
  const industry = resolveIndustry(blueprint);
  const heroText = scene.heroSubject.exactHeroSubject.value !== "unknown" ? scene.heroSubject.exactHeroSubject.value : "";
  const seed = baseSeed(blueprint.meta.blueprintId ?? "", industry, heroText);
  const referenceImageDominant = blueprint.strategy.heroDecision?.primarySignals?.includes("reference_image") ?? false;
  const heroArchetype = HERO_POSE_TO_ARCHETYPE[scene.heroSubject.heroPose.value] ?? "moment";
  const knowledge = getKnowledgeSignal(industry, heroArchetype, seed);

  const who = buildWhoGraph(blueprint, scene, seed);
  const where = buildWhereGraph(scene, seed, industry, knowledge);
  const pose = buildPoseGraph(scene, seed, referenceImageDominant);
  const { graph: body, handEvent } = buildBodyGraph(scene, seed, industry, pose);
  const objectContact = buildObjectContactGraph(who, handEvent, seed, industry);
  const materials = buildMaterialsGraph(scene, seed, industry, handEvent);
  const microMotion = buildMicroMotionGraph(seed, industry, knowledge, handEvent);
  const camera = buildCameraGraph(scene, seed, knowledge, handEvent.verbCategory !== "holding");

  const domains = { who, where, pose, body, objectContact, microMotion, camera, materials };
  const { score: completenessScore, unknownFields } = computeCompleteness(domains);
  const narrative = renderNarrative(domains);

  return {
    ...domains,
    narrative,
    meta: { seed, industry, referenceImageDominant, completenessScore, unknownFields },
  };
}
