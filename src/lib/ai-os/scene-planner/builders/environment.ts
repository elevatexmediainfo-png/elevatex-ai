import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { EnvironmentPlanning } from "../types";
import { sp } from "./shared";
import { ENVIRONMENT_BY_INDUSTRY } from "../knowledge";
import type { VTEEnrichment } from "../vte-bridge";
import { vteWouldDuplicate } from "../vte-bridge";

// Builder 4 — Environment Planning
// What is the physical and visual context of the scene?
// Phase 10.5A: VTE spatial primitive enriches backgroundStory; VTE material
// primitive enriches environmentalDetails — both only when falling back to KB.

export function buildEnvironmentPlanning(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): EnvironmentPlanning {
  const strategy = bp.strategy;
  const campaign = bp.campaign;
  const layout = bp.layout;
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const envPriority = strategy.visual.environmentPriority.value;
  const industryEnv = ENVIRONMENT_BY_INDUSTRY[industryKey ?? ""] ?? ENVIRONMENT_BY_INDUSTRY["healthcare"];

  const environmentType = (() => {
    const photoStyle = strategy.visual.photographyStyle.value;
    const styleToEnv: Record<string, EnvironmentPlanning["environmentType"]["value"]> = {
      studio_product:  "controlled_product_table",
      lifestyle:       "lifestyle_real_world",
      documentary:     "lifestyle_real_world",
      editorial:       "premium_interior",
      aerial:          "outdoor_natural",
      macro_detail:    "controlled_product_table",
      before_after:    "professional_studio",
    };
    const fromStyle = styleToEnv[photoStyle ?? ""];
    if (fromStyle) return sp(fromStyle, "high", `Environment type "${fromStyle}" from photography style "${photoStyle}"`);
    // From industry
    const envType = industryEnv.type as EnvironmentPlanning["environmentType"]["value"];
    return sp(envType, "medium", `Environment type from industry knowledge bank for "${industryKey}"`);
  })();

  const backgroundStory = (() => {
    const campaignBg = campaign.visualDirection.backgroundStory.value;
    if (campaignBg !== "unknown") return sp(campaignBg, "high", `Background story from Campaign Plan Visual Direction`);

    // Phase 10.5A — VTE spatial primitive transforms a generic KB environment
    // ("clean modern dental clinic") into a spatially specific arrangement
    // ("A consultation room where natural light streams across a minimalist counter").
    const kbBg = industryEnv.backgroundStory;
    if (vte?.hasContent && vte.spatial[0] && !vteWouldDuplicate(kbBg, vte.spatial[0].value)) {
      return sp(
        `${kbBg}; ${vte.spatial[0].value}`,
        "high",
        `Background story: industry KB enriched with VTE spatial primitive for "${vte.resolvedIndustry}"`
      );
    }

    return sp(kbBg, "medium", `Background story from industry knowledge bank for "${industryKey}"`);
  })();

  // foreground, midground, background from composition plan
  const depthData = layout.composition;
  const foreground = depthData.foreground.value !== "unknown"
    ? sp(depthData.foreground.value, "high", `Foreground from VisualLayoutPlan composition: ${depthData.foreground.reasoning}`)
    : sp("Minimal foreground element — environmental texture or props that frame the hero without competing", "low", `Default foreground: frame-enhancing environmental element`);

  const midground = depthData.midground.value !== "unknown"
    ? sp(depthData.midground.value, "high", `Midground from VisualLayoutPlan composition: ${depthData.midground.reasoning}`)
    : sp("The hero subject zone — the primary narrative plane of the scene", "medium", `Default midground: hero subject`);

  const background = depthData.background.value !== "unknown"
    ? sp(depthData.background.value, "high", `Background from VisualLayoutPlan composition: ${depthData.background.reasoning}`)
    : sp("Softly blurred environmental context that communicates brand and setting quality without competing", "medium", `Default background: blurred environmental context`);

  const environmentalDetails = (() => {
    const campaignEnv = campaign.visualDirection.environment.value;
    if (campaignEnv !== "unknown") return sp(campaignEnv, "high", `Environmental details from Campaign Plan Visual Direction`);
    if (envPriority === "immersive") {
      return sp(`${industryEnv.details} — environment plays a major narrative role, as important as the hero`, "medium",
        `Immersive environment priority → full environmental storytelling required`);
    }
    if (envPriority === "minimal" || envPriority === "none") {
      return sp("Minimal environmental detail — clean, simple context that positions the hero without distraction", "medium",
        `Minimal/no environment priority → background serves as neutral frame only`);
    }

    // Phase 10.5A — VTE material primitive adds surface-level tactile detail
    // to the KB environment description, turning "premium clinic interiors" into
    // "premium clinic interiors with brushed steel surfaces and matte white cabinetry".
    const kbDetails = industryEnv.details;
    if (vte?.hasContent && vte.material[0] && !vteWouldDuplicate(kbDetails, vte.material[0].value)) {
      return sp(
        `${kbDetails}; ${vte.material[0].value}`,
        "high",
        `Environmental details: industry KB enriched with VTE material primitive for "${vte.resolvedIndustry}"`
      );
    }

    return sp(kbDetails, "medium", `Environmental details from industry knowledge bank for "${industryKey}"`);
  })();

  return { environmentType, backgroundStory, foreground, midground, background, environmentalDetails };
}
