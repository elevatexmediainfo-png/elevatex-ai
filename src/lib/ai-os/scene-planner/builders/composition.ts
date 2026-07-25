import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { CompositionPlanning } from "../types";
import { sp } from "./shared";

// Builder 6 — Composition Planning
// How are all the scene elements spatially arranged?

export function buildCompositionPlanning(bp: UniversalCampaignBlueprint): CompositionPlanning {
  const layout = bp.layout;
  const strategy = bp.strategy;

  const primaryComposition = (() => {
    const ruleOfThirds = layout.composition.ruleOfThirds.value;
    const framingStyle = bp.campaign.photographyDirection.framingStyle.value;
    if (framingStyle === "centered_symmetry") return sp("centered_symmetry", "high", `Photography direction specifies centered symmetry`);
    if (framingStyle === "negative_space_dominant") return sp("negative_space_dominant", "high", `Photography direction specifies negative space dominance`);
    if (framingStyle === "leading_lines") return sp("leading_diagonal", "high", `Photography direction specifies leading lines composition`);
    if (framingStyle === "frame_within_frame") return sp("frame_within_frame", "high", `Photography direction specifies frame-within-frame`);
    if (ruleOfThirds === "primary_application") return sp("rule_of_thirds", "high", `Layout composition plan specifies rule of thirds`);
    if (ruleOfThirds === "intentionally_broken") return sp("centered_symmetry", "high", `Rule of thirds intentionally broken → centered for directness`);
    if (strategy.visual.luxuryLevel.value === "ultra_luxury") return sp("golden_ratio", "medium", `Ultra-luxury → golden ratio proportions communicate inherent premium`);
    return sp("rule_of_thirds", "medium", `Default: rule of thirds — the most reliable composition for commercial advertising`);
  })();

  const secondaryComposition = (() => {
    const leadingLines = layout.composition.leadingLines.value;
    if (leadingLines === "strong_leading_lines") return sp("Environmental or architectural elements direct the eye toward the hero subject", "high", `Strong leading lines from composition plan`);
    if (strategy.visual.luxuryLevel.value === "high" || strategy.visual.luxuryLevel.value === "ultra_luxury") {
      return sp("Negative space used as a secondary frame — empty areas create tension that draws the eye to the hero", "medium", `Luxury composition: negative space as secondary device`);
    }
    return sp("Colour or tonal contrast between hero and background creates secondary visual framing", "low", `Default secondary composition: tonal contrast`);
  })();

  const visualBalance = (() => {
    const balance = layout.grid.balance.value;
    const balanceMap: Record<string, CompositionPlanning["visualBalance"]["value"]> = {
      symmetrical:         "center_weighted",
      asymmetric_left_heavy:"left_weighted",
      asymmetric_right_heavy:"right_weighted",
      dynamic_tension:     "left_weighted",
    };
    const val = balanceMap[balance ?? ""] ?? "center_weighted";
    return sp(val, balance !== "unknown" ? "high" : "medium", `Visual balance "${val}" mapped from grid balance "${balance}"`);
  })();

  const symmetry = (() => {
    const sym = layout.grid.symmetry.value;
    const symMap: Record<string, CompositionPlanning["symmetry"]["value"]> = {
      bilateral:             "bilateral_symmetry",
      asymmetric_intentional:"deliberate_asymmetry",
      translational:         "translational_rhythm",
      rotational:            "radial_from_center",
    };
    const val = symMap[sym ?? ""] ?? "deliberate_asymmetry";
    return sp(val, sym !== "unknown" ? "high" : "medium", `Symmetry type "${val}" from grid symmetry "${sym}"`);
  })();

  const negativeSpace = (() => {
    const nsRatio = layout.whiteSpace.negativeSpaceRatio.value;
    const nsMap: Record<string, CompositionPlanning["negativeSpace"]["value"]> = {
      "10_to_20_percent":  "minimal_tight_content",
      "20_to_35_percent":  "balanced_breathing_room",
      "35_to_50_percent":  "generous_editorial_space",
      "50_to_65_percent":  "generous_editorial_space",
      "65_plus_percent":   "extreme_luxury_space",
    };
    const val = nsMap[nsRatio ?? ""] ?? "balanced_breathing_room";
    return sp(val, nsRatio !== "unknown" ? "high" : "medium", `Negative space "${val}" from layout whitespace ratio "${nsRatio}"`);
  })();

  const depth = (() => {
    const depthLayer = layout.composition.depthLayers.value;
    const depthMap: Record<string, CompositionPlanning["depth"]["value"]> = {
      two_layer_flat:             "shallow_foreground_blur",
      three_layer_standard:       "three_layer_natural",
      four_plus_layer_cinematic:  "four_layer_cinematic",
    };
    const val = depthMap[depthLayer ?? ""] ?? "three_layer_natural";
    return sp(val, depthLayer !== "unknown" ? "high" : "medium", `Depth treatment "${val}" from composition plan "${depthLayer}"`);
  })();

  return { primaryComposition, secondaryComposition, visualBalance, symmetry, negativeSpace, depth };
}
