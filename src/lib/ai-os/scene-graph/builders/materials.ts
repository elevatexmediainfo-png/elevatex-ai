import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MaterialTier } from "../../prompt-spec/material-engine";
import type { MaterialsGraph } from "../types";
import { sg } from "../field";
import { axisSeed, pick } from "../seed";
import { MATERIAL_NOUNS, FINISH_DESCRIPTORS, LIGHT_INTERACTION_PHRASES, TEXTURE_DETAIL_PHRASES } from "../vocabulary";
import type { HandEvent } from "./body";

// Phase 10.6B — MATERIALS graph builder.
// Replaces prompt-spec/material-engine.ts's static per-(industry × tier)
// lookup sentence with four INDEPENDENT axes — material noun, finish
// descriptor, light-interaction clause, and (for the contact object) a
// keyword hint pulled from live campaign object text — composed together.
// material-engine.ts had 33 fixed cells (11 industries × 3 tiers), each one
// full pre-written sentence. Here, tier × material-noun-pool(4) ×
// finish(4-5) × light-interaction(5) already yields hundreds of distinct
// architectureMaterial sentences alone, before crossing with the other three
// material fields.

const LUXURY_TO_TIER: Record<string, MaterialTier> = {
  utility_functional:     "mass",
  professional_quality:   "mid",
  premium_polished:       "mid",
  luxury_refined:         "luxury",
  ultra_prestige_perfect: "luxury",
};

const OBJECT_MATERIAL_HINTS: Record<string, string> = {
  ceramic: "ceramic", porcelain: "porcelain", glass: "glass", wood: "wood", metal: "brushed metal",
  steel: "brushed steel", leather: "leather", fabric: "woven fabric", paper: "paper", tweezers: "brushed steel",
  wine: "cut glass", plate: "glazed ceramic", tray: "polished metal", instrument: "sterile steel",
};

const REFLECTIVE_ACCENTS = [
  "brass fixtures", "a polished chrome edge", "a mirrored panel", "an overhead pendant light", "a glass surface",
] as const;

function composeMaterial(noun: string, tier: MaterialTier, seed: number, axis: string): string {
  const finish = pick(FINISH_DESCRIPTORS[tier], axisSeed(seed, `${axis}:finish`));
  const light = pick(LIGHT_INTERACTION_PHRASES, axisSeed(seed, `${axis}:light`));
  return `${finish} ${noun}, ${light}`;
}

export function buildMaterialsGraph(
  scene: VisualScenePlan,
  seed: number,
  industry: SceneIndustry,
  handEvent: HandEvent,
): MaterialsGraph {
  const luxuryKey = scene.renderingIntent.luxuryLevel.value;
  const tier: MaterialTier = LUXURY_TO_TIER[luxuryKey] ?? "mid";
  const tierConfidence = scene.renderingIntent.luxuryLevel.confidence === "unknown" ? "low" : "medium";

  const archNoun = pick(MATERIAL_NOUNS.architecture[tier], axisSeed(seed, "materials:archNoun"));
  const architectureMaterial = sg(composeMaterial(archNoun, tier, seed, "materials:arch"), tierConfidence, `Scene Graph MATERIALS: architecture material composed for the "${tier}" tier (from Visual Scene Plan luxury level "${luxuryKey}")`);

  const surfaceNoun = pick(MATERIAL_NOUNS.surface[tier], axisSeed(seed, "materials:surfaceNoun"));
  const surfaceMaterial = sg(composeMaterial(surfaceNoun, tier, seed, "materials:surface"), tierConfidence, `Scene Graph MATERIALS: surface material composed for the "${tier}" tier`);

  const objectHintKey = Object.keys(OBJECT_MATERIAL_HINTS).find((k) => handEvent.primaryObject.toLowerCase().includes(k));
  const objectNoun = objectHintKey ? OBJECT_MATERIAL_HINTS[objectHintKey]! : pick(MATERIAL_NOUNS.object[tier], axisSeed(seed, "materials:objectNoun"));
  const objectMaterial = sg(
    composeMaterial(objectNoun, tier, seed, "materials:object"),
    objectHintKey ? "high" : tierConfidence,
    objectHintKey
      ? `Scene Graph MATERIALS: material inferred from the contact object "${handEvent.primaryObject}" itself`
      : `Scene Graph MATERIALS: no material hint in the contact object text — "${tier}"-tier vocabulary fallback`,
  );

  const fabricNoun = pick(MATERIAL_NOUNS.fabric[tier], axisSeed(seed, "materials:fabricNoun"));
  const fabricMaterial = sg(composeMaterial(fabricNoun, tier, seed, "materials:fabric"), tierConfidence, `Scene Graph MATERIALS: fabric composed for the "${tier}" tier`);

  const textureOptions = TEXTURE_DETAIL_PHRASES[industry];
  const textureDetail = sg(pick(textureOptions, axisSeed(seed, "materials:texture")), "medium", `Scene Graph MATERIALS: texture detail selected from the ${industry} vocabulary bank`);

  const accent = pick(REFLECTIVE_ACCENTS, axisSeed(seed, "materials:reflectionAccent"));
  const reflectionStyle = scene.lighting.reflectionStyle.value;
  const reflection = sg(
    // Subject is always "a reflection" (singular) regardless of whether the
    // chosen accent noun is singular ("a mirrored panel") or plural ("brass
    // fixtures") — avoids a subject-verb agreement error either way.
    `a reflection of ${accent} plays across the ${surfaceNoun}`,
    reflectionStyle !== "unknown" ? scene.lighting.reflectionStyle.confidence : "medium",
    reflectionStyle !== "unknown"
      ? `Scene Graph MATERIALS: reflection composed from the chosen surface material, consistent with Visual Scene Plan reflection style "${reflectionStyle}"`
      : "Scene Graph MATERIALS: reflection composed from the chosen surface material — no upstream reflection style signal",
  );

  return { architectureMaterial, surfaceMaterial, objectMaterial, fabricMaterial, textureDetail, reflection };
}
