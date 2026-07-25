import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneGraph } from "../../scene-graph/types";
import type { EnvironmentSpec } from "../types";
import { promoteField, psf, sceneGraphJoin } from "./shared";

// Builder 7 — Environment Specification
// Promotes environment decisions from VisualScenePlan. environmentType stays
// enum-sourced unchanged (same reasoning as camera height — Scene Graph's
// equivalent is the same signal naturalised, not new information). premiumDetails
// is where Scene Graph's MATERIALS graph — architecture material, surface
// material, reflection — has no other home in PromptSpecification; this field's
// own definition ("quality and brand credibility details") is exactly what
// physical material description is, so it's enriched here rather than left
// unreachable.

export function buildEnvironmentSpec(scene: VisualScenePlan, graph?: SceneGraph): EnvironmentSpec {
  const base = promoteField(scene.environment.environmentalDetails, "scene.environment.details");
  const premiumDetails = (() => {
    if (!graph) return base;
    const materials = sceneGraphJoin([graph.materials.architectureMaterial, graph.materials.surfaceMaterial, graph.materials.reflection]);
    if (materials.length === 0) return base;
    const combined = base.value !== "unknown" ? `${base.value}. ${materials.join(". ")}` : materials.join(". ");
    return psf(combined, "high", "[scene.environment.details] enriched with Scene Graph materials (architecture, surface, reflection) — not independently regenerated");
  })();

  return {
    environmentType: promoteField(scene.environment.environmentType,   "scene.environment.type"),
    storyContext:    promoteField(scene.environment.backgroundStory,   "scene.environment.story"),
    premiumDetails,
  };
}
