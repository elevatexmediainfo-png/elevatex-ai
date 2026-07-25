import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { VisualLayoutPlan } from "../../visual-layout/types";
import type { TypographyRhythm } from "../types";
import { tf } from "./shared";
import { getRhythmSpec } from "../knowledge";

// Builder 8 — Typography Rhythm
// Sole responsibility: define the spatial relationships between all text
// elements — line height, paragraph gaps, letter spacing, and overall rhythm.

export function buildTypographyRhythm(
  strategy: CreativeStrategy,
  plan: CampaignPlan,
  layout: VisualLayoutPlan
): TypographyRhythm {
  const designStyle = plan.designDirection.overallDesignStyle.value;
  const luxury = strategy.visual.luxuryLevel.value;
  const breathingRoomLayout = layout.whiteSpace.breathingRoom.value;
  const spec = getRhythmSpec(designStyle !== "unknown" ? designStyle : "editorial_clean");

  const lineHeight = (() => {
    // Luxury layouts want more space between lines
    if (luxury === "ultra_luxury") return tf("editorial_1_8_plus", "high",
      `Ultra-luxury: generous line height signals premium; tight leading signals urgency or mass market`);
    return tf(
      spec.lineHeight as TypographyRhythm["lineHeight"]["value"],
      designStyle !== "unknown" ? "high" : "medium",
      `Line height "${spec.lineHeight}" from design system spec for "${designStyle}"`
    );
  })();

  const paragraphGap = (() => {
    if (breathingRoomLayout === "extreme_isolation" || breathingRoomLayout === "generous_isolation") {
      return tf("generous_spacious", "high",
        `Layout breathing room="${breathingRoomLayout}" → generous paragraph gaps sustain the spatial philosophy`);
    }
    if (breathingRoomLayout === "tight_proximity") {
      return tf("tight_minimal", "high",
        `Layout breathing room="tight" → tight paragraph gaps maximise information density`);
    }
    return tf(
      spec.paragraphGap as TypographyRhythm["paragraphGap"]["value"],
      "medium",
      `Paragraph gap "${spec.paragraphGap}" from design system spec`
    );
  })();

  const letterSpacing = (() => {
    if (luxury === "ultra_luxury" || luxury === "high") return tf("ultra_loose_luxury", "high",
      `Luxury: generous letter spacing on headlines signals premium quality — tight tracking is for utility typefaces`);
    if (plan.designDirection.overallDesignStyle.value === "corporate_professional") {
      return tf("tight_condensed", "medium",
        `Corporate professional: slightly tighter tracking signals authority and density`);
    }
    return tf(
      spec.letterSpacing as TypographyRhythm["letterSpacing"]["value"],
      "medium",
      `Letter spacing "${spec.letterSpacing}" from design system spec for "${designStyle}"`
    );
  })();

  const visualRhythm = tf(
    spec.visualRhythm as TypographyRhythm["visualRhythm"]["value"],
    designStyle !== "unknown" ? "high" : "medium",
    `Visual rhythm "${spec.visualRhythm}" for "${designStyle}" design — describes how spacing varies across the creative`
  );

  const breathingSpace = (() => {
    const breathing: Record<string, string> = {
      extreme_isolation: "Every text element is isolated by generous margins — text 'breathes' in spacious white space; nothing crowds anything",
      generous_isolation:"Text blocks have clear breathing zones; each group of text has visible separation from the next",
      comfortable_padding:"Standard commercial spacing — elements are separated enough to read distinctly without excess empty space",
      tight_proximity:   "Information-dense layout — text elements sit close together; clarity comes from size contrast, not space",
    };
    const val = breathing[breathingRoomLayout ?? ""] ?? breathing.comfortable_padding;
    return tf(val, breathingRoomLayout !== "unknown" ? "high" : "medium",
      `Breathing space philosophy derived from layout breathing room "${breathingRoomLayout}"`);
  })();

  return { lineHeight, paragraphGap, letterSpacing, visualRhythm, breathingSpace };
}
