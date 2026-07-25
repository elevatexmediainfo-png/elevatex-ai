import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneGraph } from "../../scene-graph/types";
import type { CompositionSpec } from "../types";
import { promoteField, psf, sceneGraphUsable } from "./shared";

// Builder 4 — Composition Specification
// Promotes composition decisions from VisualScenePlan.
// Phase 10.4H: secondaryComposition + symmetry (from scene), eyeFlow (from layout).
// Phase 10.6C: foreground/midground/background prefer Scene Graph's WHERE graph
// when present — scene-graph/builders/where.ts already either passes the same
// VisualScenePlan text through verbatim (no-op here) or fills a previously
// "unknown" gap with a vocabulary-bank fallback (a strict improvement), so
// preferring it is always safe and never independently regenerates the field.

function preferGraph(graphField: { value: string } | undefined, sceneField: { value: string; confidence: import("../../types").FieldConfidence }, contextLabel: string) {
  if (sceneGraphUsable(graphField)) {
    return psf(graphField.value, "high", `[${contextLabel}] provided by Scene Graph WHERE — not independently regenerated`);
  }
  return promoteField(sceneField, contextLabel);
}

export function buildCompositionSpec(scene: VisualScenePlan, bp: UniversalCampaignBlueprint, graph?: SceneGraph): CompositionSpec {
  const secondaryComposition = (() => {
    const v = scene.composition.secondaryComposition.value;
    if (v !== "unknown") return promoteField(scene.composition.secondaryComposition, "scene.composition.secondary");
    return undefined;
  })();

  const symmetry = (() => {
    const v = scene.composition.symmetry.value;
    if (v !== "unknown") return promoteField(scene.composition.symmetry, "scene.composition.symmetry");
    return undefined;
  })();

  const eyeFlow = (() => {
    const v = bp.layout.hierarchy.eyeFlow.value;
    if (v !== "unknown") return promoteField(bp.layout.hierarchy.eyeFlow, "layout.hierarchy.eyeFlow");
    return undefined;
  })();

  return {
    primaryComposition: promoteField(scene.composition.primaryComposition,  "scene.composition.primary"),
    ...(secondaryComposition ? { secondaryComposition } : {}),
    visualBalance:      promoteField(scene.composition.visualBalance,       "scene.composition.balance"),
    ...(symmetry  ? { symmetry }  : {}),
    negativeSpace:      promoteField(scene.composition.negativeSpace,       "scene.composition.negativeSpace"),
    ...(eyeFlow   ? { eyeFlow }   : {}),
    foreground:         preferGraph(graph?.where.foreground, scene.environment.foreground, "scene.environment.foreground"),
    midground:          preferGraph(graph?.where.midground,  scene.environment.midground,  "scene.environment.midground"),
    background:         preferGraph(graph?.where.background, scene.environment.background, "scene.environment.background"),
    depthTreatment:     promoteField(scene.composition.depth,               "scene.composition.depth"),
  };
}
