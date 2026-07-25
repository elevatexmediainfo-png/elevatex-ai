import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { CompositionPlanning } from "../types";
import { lf } from "./shared";
import { getDepthLayers } from "../knowledge";

// Builder 6 — Composition Planning
// Sole responsibility: determine how elements are arranged in 3D space
// to create depth, direction, and visual tension.

export function buildCompositionPlanning(strategy: CreativeStrategy, plan: CampaignPlan): CompositionPlanning {
  const framingStyle = plan.photographyDirection.framingStyle.value;
  const photoStyle = strategy.visual.photographyStyle.value;
  const luxury = strategy.visual.luxuryLevel.value;
  const depthData = getDepthLayers(photoStyle !== "unknown" ? photoStyle : "editorial");

  const ruleOfThirds = (() => {
    if (framingStyle === "rule_of_thirds") return lf("primary_application", "high",
      `Photography direction explicitly specifies rule of thirds framing`);
    if (framingStyle === "centered_symmetry") return lf("intentionally_broken", "high",
      `Centered symmetry framing breaks rule of thirds by design — power through directness`);
    if (framingStyle === "negative_space_dominant") return lf("partial_application", "high",
      `Negative space framing uses rule of thirds for subject placement but emphasises the void`);
    if (luxury === "ultra_luxury" || luxury === "high") return lf("intentionally_broken", "medium",
      `High luxury → subjects placed centrally for prestige; rule of thirds is intentionally abandoned`);
    return lf("primary_application", "medium", `Default rule of thirds — reliable composition principle for commercial work`);
  })();

  const goldenRatioPreference = (() => {
    if (luxury === "high" || luxury === "ultra_luxury") return lf("preferred_for_hero", "high",
      `Luxury contexts benefit from golden ratio proportions — they feel innately premium`);
    if (framingStyle === "leading_lines") return lf("optional_accent", "medium",
      `Leading lines layout benefits optionally from golden ratio curves`);
    return lf("not_applied", "medium", `Golden ratio not applied — rule of thirds sufficient for this campaign`);
  })();

  const leadingLines = (() => {
    if (framingStyle === "leading_lines") return lf("strong_leading_lines", "high",
      `Photography direction specifies leading lines as the primary compositional device`);
    if (photoStyle === "aerial") return lf("strong_leading_lines", "high",
      `Aerial photography inherently creates leading lines from roads, coastlines, architecture`);
    if (photoStyle === "editorial") return lf("subtle_directional_flow", "medium",
      `Editorial photography uses subtle directional cues to guide the eye`);
    return lf("none", "medium", `No leading lines required for this composition type`);
  })();

  const depthLayers = lf(
    depthData.layers as CompositionPlanning["depthLayers"]["value"],
    photoStyle !== "unknown" ? "high" : "medium",
    `Depth layer structure "${depthData.layers}" for photography style="${photoStyle}"`
  );

  const foreground = lf(depthData.foreground, "high",
    `Foreground role from photography style="${photoStyle}" composition knowledge`);

  const midground = lf(depthData.midground, "high",
    `Midground role — the primary subject zone in "${photoStyle}" photography`);

  const background = lf(depthData.background, "high",
    `Background treatment for "${photoStyle}" — contextualises without competing`);

  return { ruleOfThirds, goldenRatioPreference, leadingLines, depthLayers, foreground, midground, background };
}
