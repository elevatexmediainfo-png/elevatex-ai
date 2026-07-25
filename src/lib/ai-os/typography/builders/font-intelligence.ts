import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { FontIntelligence } from "../types";
import { tf } from "./shared";
import { getFontPersonality, HEADLINE_FONT_CHARACTER, BODY_FONT_CHARACTER } from "../knowledge";

// Builder 2 — Font Intelligence
// Sole responsibility: define the typographic character and personality
// for this creative. NEVER selects actual font families.

export function buildFontIntelligence(
  strategy: CreativeStrategy,
  plan: CampaignPlan
): FontIntelligence {
  const industryKey = strategy.business.subIndustry.value !== "unknown"
    ? strategy.business.subIndustry.value
    : strategy.business.industry.value;
  const designStyle = plan.designDirection.overallDesignStyle.value;
  const luxury = strategy.visual.luxuryLevel.value;
  const tone = strategy.communication.tone.value;

  // Determine font personality
  const personalityKey = getFontPersonality(industryKey ?? "", designStyle ?? "");

  // Tone can override personality
  const finalPersonality = (() => {
    if (tone === "formal" && personalityKey === "friendly") return "corporate";
    if (tone === "educational" && !["medical", "corporate"].includes(personalityKey)) return "editorial";
    if (luxury === "ultra_luxury" || luxury === "high") return "luxury";
    return personalityKey;
  })();

  const fontPersonality = tf(
    finalPersonality as FontIntelligence["fontPersonality"]["value"],
    industryKey !== "unknown" ? "high" : "medium",
    `Font personality "${finalPersonality}" determined from industry="${industryKey}" × design="${designStyle}" × luxury="${luxury}"`
  );

  const headlineFontCharacter = (() => {
    const char = HEADLINE_FONT_CHARACTER[finalPersonality] ?? HEADLINE_FONT_CHARACTER.modern;
    return tf(char, "high", `Headline character for "${finalPersonality}" personality`);
  })();

  const bodyFontCharacter = (() => {
    const char = BODY_FONT_CHARACTER[finalPersonality] ?? BODY_FONT_CHARACTER.modern;
    return tf(char, "high", `Body character for "${finalPersonality}" personality — complements headline`);
  })();

  // System fonts vs brand fonts
  const systemFontSufficient = (() => {
    if (finalPersonality === "luxury" || finalPersonality === "editorial") {
      return tf("no_brand_font_required", "high",
        `Luxury/editorial personality demands a distinctive typeface — system fonts cannot convey this quality`);
    }
    if (finalPersonality === "technology" || finalPersonality === "modern") {
      return tf("yes_with_careful_selection", "medium",
        `Technology/modern personalities can work with carefully selected system fonts (SF Pro, Segoe UI)`);
    }
    return tf("yes_system_fonts_appropriate", "medium",
      `This personality can be served by professional system fonts with correct weight usage`);
  })();

  const distinctiveTypefaceNeeded = (() => {
    if (finalPersonality === "luxury") return tf("essential", "high",
      `Luxury positioning cannot be communicated through generic typefaces — distinctive typeface is essential`);
    if (finalPersonality === "editorial") return tf("preferred", "high",
      `Editorial aesthetic strongly benefits from a distinctive, quality typeface`);
    if (finalPersonality === "friendly" || finalPersonality === "minimal") return tf("optional", "medium",
      `Friendly/minimal personalities can succeed without distinctive typefaces`);
    return tf("not_needed", "medium",
      `This personality does not require a distinctive typeface to communicate effectively`);
  })();

  return { fontPersonality, headlineFontCharacter, bodyFontCharacter, systemFontSufficient, distinctiveTypefaceNeeded };
}
