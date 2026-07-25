import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { LightingSpec } from "../types";
import { promoteField, psf } from "./shared";

// Builder 6 — Lighting Specification
// Promotes lighting decisions from VisualScenePlan.
// Phase 10.4H: cameraMood from campaign.photographyDirection (previously dead).

export function buildLightingSpec(scene: VisualScenePlan, bp: UniversalCampaignBlueprint): LightingSpec {
  const cameraMood = (() => {
    const mood = bp.campaign.photographyDirection.cameraMood.value;
    if (mood !== "unknown") return psf(mood.slice(0, 150),
      bp.campaign.photographyDirection.cameraMood.confidence,
      `Overall photographic mood from Creative Director PhotographyDirection`);
    return undefined;
  })();

  return {
    primaryLighting:   promoteField(scene.lighting.primaryLight,    "scene.lighting.primary"),
    secondaryLighting: promoteField(scene.lighting.secondaryLight,  "scene.lighting.secondary"),
    moodLighting:      promoteField(scene.lighting.moodLighting,    "scene.lighting.mood"),
    shadowStyle:       promoteField(scene.lighting.shadowStyle,     "scene.lighting.shadows"),
    reflectionStyle:   promoteField(scene.lighting.reflectionStyle, "scene.lighting.reflection"),
    ...(cameraMood ? { cameraMood } : {}),
  };
}
