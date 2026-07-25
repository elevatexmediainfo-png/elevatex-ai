import type { CreativeStrategy } from "../../creative-brain/types";
import type { DesignDirection } from "../types";
import { cf } from "./shared";

// Builder 7 — Design Direction
// Sole responsibility: determine the overall visual design philosophy.
// Reads: strategy.visual, strategy.communication, strategy.creative
// Never generates typography specs, color palettes, or layout grids.

export function buildDesignDirection(strategy: CreativeStrategy): DesignDirection {
  const luxury = strategy.visual.luxuryLevel.value;
  const minimalism = strategy.visual.minimalismLevel.value;
  const premium = strategy.visual.premiumFeel.value;
  const modern = strategy.visual.modernStyle.value;
  const density = strategy.creative.informationDensity.value;
  const style = strategy.communication.communicationStyle.value;

  const overallDesignStyle = (() => {
    if (luxury === "ultra_luxury" || luxury === "high") return cf("luxury_minimal", "high",
      `Luxury level="${luxury}" → luxury minimal design style signals prestige through restraint`);
    if (style === "authority" || style === "professional") return cf("corporate_professional", "high",
      `Communication style="${style}" → corporate professional design appropriate`);
    if (density === "complex_infographic") return cf("informational_structured", "high",
      `Complex infographic density → informational structured design maximises clarity`);
    if (style === "friendly" || style === "emotional") return cf("warm_approachable", "medium",
      `Communication style="${style}" → warm approachable design connects emotionally`);
    if (modern === "cutting_edge") return cf("modern_bold", "medium",
      `Modern style="cutting_edge" → modern bold design signals innovation`);
    if (premium === "premium" || premium === "luxury") return cf("editorial_clean", "high",
      `Premium feel="${premium}" → editorial clean design communicates quality through precision`);
    return cf("editorial_clean", "medium", `Default editorial clean — professional and versatile`);
  })();

  const luxuryLevelResult = (() => {
    const map: Record<string, DesignDirection["luxuryLevel"]["value"]> = {
      none:        "utility_functional",
      low:         "consumer_quality",
      medium:      "premium_polished",
      high:        "luxury_refined",
      ultra_luxury:"ultra_prestige",
    };
    const val = map[luxury ?? ""] ?? "premium_polished";
    return cf(val, luxury !== "unknown" ? "high" : "medium",
      `Luxury level from Visual Reasoning: "${luxury}" → design luxury tier="${val}"`);
  })();

  const minimalismResult = (() => {
    const map: Record<string, DesignDirection["minimalism"]["value"]> = {
      extreme:  "ultra_minimal",
      high:     "generous_editorial",
      moderate: "clean_focused",
      low:      "balanced_commercial",
      none:     "information_dense",
    };
    const val = map[minimalism ?? ""] ?? "balanced_commercial";
    return cf(val, minimalism !== "unknown" ? "high" : "medium",
      `Minimalism level="${minimalism}" → design approach="${val}"`);
  })();

  const editorialFeel = (() => {
    if (luxury === "high" || luxury === "ultra_luxury") return cf("magazine_quality", "high",
      `High luxury → magazine quality editorial feel signals the same tier as the brand`);
    if (style === "authority" || style === "professional") return cf("press_release_credible", "medium",
      `Authority communication → press-release credible feel builds institutional trust`);
    if (style === "educational") return cf("editorial_inspired", "medium",
      `Educational content → editorial-inspired feel positions the brand as a knowledge authority`);
    return cf("editorial_inspired", "low", `Default editorial-inspired feel for commercial advertising quality`);
  })();

  const modernFeelResult = (() => {
    const map: Record<string, DesignDirection["modernFeel"]["value"]> = {
      classic:       "classic_enduring",
      contemporary:  "contemporary_relevant",
      modern:        "modern_fresh",
      cutting_edge:  "cutting_edge_progressive",
    };
    const val = map[modern ?? ""] ?? "contemporary_relevant";
    return cf(val, modern !== "unknown" ? "high" : "low",
      `Modern style="${modern}" → design feel="${val}"`);
  })();

  const premiumFeelResult = (() => {
    const map: Record<string, DesignDirection["premiumFeel"]["value"]> = {
      basic:    "practical_accessible",
      standard: "professional_quality",
      premium:  "premium_craft",
      luxury:   "luxury_perfection",
    };
    const val = map[premium ?? ""] ?? "professional_quality";
    return cf(val, premium !== "unknown" ? "high" : "low",
      `Premium feel="${premium}" from Visual Reasoning → design premium tier="${val}"`);
  })();

  const informationDensityResult = (() => {
    const map: Record<string, DesignDirection["informationDensity"]["value"]> = {
      single_message:    "single_idea",
      two_elements:      "focused_message",
      multi_element:     "structured_content",
      complex_infographic:"comprehensive_detail",
    };
    const val = map[density ?? ""] ?? "structured_content";
    return cf(val, density !== "unknown" ? "high" : "medium",
      `Information density="${density}" → design density tier="${val}"`);
  })();

  return {
    overallDesignStyle,
    luxuryLevel: luxuryLevelResult,
    minimalism: minimalismResult,
    editorialFeel,
    modernFeel: modernFeelResult,
    premiumFeel: premiumFeelResult,
    informationDensity: informationDensityResult,
  };
}
