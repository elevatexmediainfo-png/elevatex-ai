import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { WhiteSpaceIntelligence } from "../types";
import { lf } from "./shared";
import { NEGATIVE_SPACE_BY_LUXURY } from "../knowledge";

// Builder 5 — White Space Intelligence
// Sole responsibility: determine how empty space is used as a design element.

export function buildWhiteSpaceIntelligence(strategy: CreativeStrategy, plan: CampaignPlan): WhiteSpaceIntelligence {
  const luxury = strategy.visual.luxuryLevel.value;
  const density = strategy.creative.informationDensity.value;
  const designStyle = plan.designDirection.overallDesignStyle.value;

  const negativeSpaceRatio = (() => {
    const ratioFromLuxury = NEGATIVE_SPACE_BY_LUXURY[luxury ?? ""] ?? "20_to_35_percent";
    // Informational dense content overrides luxury space
    if (density === "complex_infographic") return lf("10_to_20_percent", "high",
      `Complex infographic density requires tight space — information must fit`);
    if (density === "single_message") return lf("65_plus_percent", "high",
      `Single message → extreme negative space gives the one message maximum power`);
    return lf(
      ratioFromLuxury as WhiteSpaceIntelligence["negativeSpaceRatio"]["value"],
      luxury !== "unknown" ? "high" : "medium",
      `Negative space ratio "${ratioFromLuxury}" for luxury level="${luxury}" — space signals premium`
    );
  })();

  const breathingRoom = (() => {
    const roomMap: Record<string, WhiteSpaceIntelligence["breathingRoom"]["value"]> = {
      ultra_luxury:  "extreme_isolation",
      high:          "generous_isolation",
      medium:        "comfortable_padding",
      low:           "tight_proximity",
      none:          "tight_proximity",
    };
    const val = roomMap[luxury ?? ""] ?? "comfortable_padding";
    return lf(val, luxury !== "unknown" ? "high" : "medium",
      `Breathing room "${val}" ensures visual clarity at luxury level="${luxury}"`);
  })();

  const contentDensity = (() => {
    const densityMap: Record<string, WhiteSpaceIntelligence["contentDensity"]["value"]> = {
      single_message:    "single_focus",
      two_elements:      "two_elements",
      multi_element:     "structured_multi",
      complex_infographic:"complex_infographic",
    };
    const val = densityMap[density ?? ""] ?? "structured_multi";
    return lf(val, density !== "unknown" ? "high" : "medium",
      `Content density "${val}" from Creative Brain information density decision "${density}"`);
  })();

  const visualWeight = (() => {
    // Use AdvertisementStructure hero section format (Phase 5 enum values)
    const heroFormat = plan.advertisementStructure.heroSection.value;
    if (heroFormat === "split_visual_text") return lf("left_weighted", "high",
      `Split visual-text format → visual mass concentrated on left; text on right balances`);
    if (heroFormat === "product_hero") return lf("center_weighted", "high",
      `Product hero format → weight at centre; negative space surrounds all sides`);
    if (heroFormat === "headline_dominant") return lf("top_heavy", "high",
      `Headline dominant → typographic mass commands the top zone`);
    if (designStyle === "luxury_minimal") return lf("evenly_distributed", "medium",
      `Luxury minimal → weight distributed evenly through deliberate negative space`);
    return lf("top_heavy", "medium", `Default top-heavy visual weight — hero commands the upper canvas`);
  })();

  return { negativeSpaceRatio, breathingRoom, contentDensity, visualWeight };
}
