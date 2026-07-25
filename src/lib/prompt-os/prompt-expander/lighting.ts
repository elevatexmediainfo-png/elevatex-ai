import type { UniversalPrompt } from "../schema";
import type { AssetAnalysisResult } from "../../design-intelligence/schema";
import type { IndustryProfile, PromptRichnessTier } from "./types";

export interface LightingEnrichment {
  lighting: Pick<UniversalPrompt["lighting"], "direction" | "quality" | "type">;
  // Always produced as a real array below (never left undefined), unlike
  // the schema's optional `palette` field — overridden here so callers
  // don't need an unnecessary undefined-check.
  colors: { palette: string[] } & Pick<UniversalPrompt["colors"], "harmony">;
}

// Reference Intelligence — when a reference image's analysis is present
// (already echoed onto the prompt by builder.ts, Phase 2.3), its visual
// language is BLENDED into the lighting/color phrasing, never lifted
// verbatim or treated as an instruction to copy the source image. The
// analysis itself is already a description, not the image, so weaving its
// text in here is the literal "extract Creative DNA, blend it naturally"
// requirement — not a new copying risk.
export function buildLightingEnrichment(
  prompt: UniversalPrompt,
  profile: IndustryProfile,
  tier: PromptRichnessTier
): LightingEnrichment {
  const reference = prompt.referenceAnalysis as AssetAnalysisResult | undefined;
  const richTier = tier === "luxury" || tier === "cinematic";

  const direction = [prompt.lighting.direction, reference?.lighting].filter(Boolean).join("; ") || "soft directional key light";

  const quality = [
    prompt.lighting.quality || "soft, diffused, professionally controlled",
    richTier ? "with cinematic lighting and premium color grading" : "with natural, commercial-grade clarity",
  ].join(", ");

  const type = [prompt.lighting.type, profile.atmosphere].filter(Boolean).join(" — ");

  const brandColors = (prompt.branding.brandColors ?? []).filter(Boolean);
  const curatedPalette = [profile.paletteLanguage, reference?.visualLanguage].filter(Boolean) as string[];
  const palette = [...(prompt.colors.palette ?? []), ...brandColors, ...curatedPalette];
  const dedupedPalette = Array.from(new Set(palette.map((p) => p.trim()).filter(Boolean)));

  const harmony = prompt.colors.harmony || (richTier ? "a refined, intentional color harmony" : "a natural, balanced color harmony");

  return {
    lighting: { direction, quality, type },
    colors: { palette: dedupedPalette, harmony },
  };
}
