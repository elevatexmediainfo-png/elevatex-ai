import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { VisualLayoutPlan } from "../../visual-layout/types";
import type { TextAlignment } from "../types";
import { tf } from "./shared";

// Builder 4 — Text Alignment
// Sole responsibility: determine text alignment for every text level.

export function buildTextAlignment(
  strategy: CreativeStrategy,
  plan: CampaignPlan,
  layout: VisualLayoutPlan
): TextAlignment {
  const gridAlignment = layout.grid.alignment.value;
  const platform = strategy.platform.primaryPlatform.value;
  const heroFormat = plan.advertisementStructure.heroSection.value;
  const luxury = strategy.visual.luxuryLevel.value;

  // Primary alignment — drives everything else
  const primaryAlignment = (() => {
    // split_visual_text IS in Phase 5's heroSection enum; left_half_split is Phase 6's block position
    if (heroFormat === "split_visual_text") {
      return tf("left", "high", `Split visual-text format → text is on the right half, left-aligned`);
    }
    if (luxury === "ultra_luxury" || luxury === "high") {
      return tf("center", "high", `Luxury → centered alignment projects confidence and refinement`);
    }
    if (gridAlignment === "left_aligned") return tf("left", "high", `Grid alignment=left → text alignment follows`);
    if (gridAlignment === "centered") return tf("center", "high", `Grid alignment=centered → centered text alignment`);
    if (platform === "instagram" || platform === "facebook") return tf("center", "medium",
      `Social platforms → centered text maximises visual impact in feed`);
    return tf("left", "medium", `Default left alignment — strongest reading convention for Western audiences`);
  })();

  const headlineAlignment = (() => {
    const primary = primaryAlignment.value;
    // Headlines follow the primary alignment — "right" is not produced by primaryAlignment
    if (primary === "center") return tf("center", "high", `Headline centered to match primary alignment`);
    if (primary === "left") return tf("left", "high", `Headline left-aligned to match primary alignment`);
    return tf("center", "medium", `Default center alignment for headline`);
  })();

  const bodyAlignment = (() => {
    const primary = primaryAlignment.value;
    // Body is always left or centered — never justified on screen (causes uneven rivers)
    if (primary === "left") return tf("left", "high", `Body alignment matches primary left alignment — best for readability`);
    if (primary === "center") return tf("center", "medium",
      `Body centered to match primary; keep lines short (5-7 words) when center-aligned`);
    return tf("left", "medium", `Default left alignment for body — universal readability standard`);
  })();

  const ctaAlignment = (() => {
    const ctaBlock = layout.blocks.ctaBlock.value;
    if (ctaBlock === "bottom_center_prominent" || ctaBlock === "lower_third_centered") {
      return tf("center", "high", `CTA block is center-positioned → center alignment maximises button tap target`);
    }
    if (ctaBlock === "bottom_right_accent") return tf("right", "high", `Right-positioned CTA → right alignment`);
    return tf("center", "medium", `Default center CTA alignment — maximum visual impact and tap-ability`);
  })();

  const platformSpecificNote = (() => {
    if (platform === "outdoor") return tf(
      "Outdoor: single line of text, maximum 7 words, left or center only — right alignment loses visibility at speed",
      "high", `Outdoor platform requires specific alignment constraints`);
    if (layout.canvas.canvasType.value === "story_vertical") return tf(
      "Story vertical: centered text over full-bleed image; left alignment only if text occupies less than 40% of width",
      "high", `Story vertical canvas has specific alignment requirements for UI safety zones`);
    return tf(
      "No platform-specific override — follow primary alignment throughout",
      "medium", `Standard platform alignment rules apply`);
  })();

  return { primaryAlignment, headlineAlignment, bodyAlignment, ctaAlignment, platformSpecificNote };
}
