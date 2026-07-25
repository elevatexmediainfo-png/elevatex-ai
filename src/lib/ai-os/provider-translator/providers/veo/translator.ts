import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import {
  buildHeroSection,
  buildLightingSection,
  buildEnvironmentSection,
  buildVisibleEmotionSection,
  estimateTokens,
} from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { VEO_QUALITY_BOOSTERS, VEO_LIMITS } from "./quality";

// Phase 10.4G — Veo Semantic Compiler.
// Video prompts use temporal language: scene setup → action → emotion → resolution.
// Hero section now uses the full richer builder (all identity/pose fields preserved).
// Visible emotion section converts psychology into visible on-screen behaviour.

const TRANSLATOR_VERSION = "2.0.0";

class VeoTranslator implements ProviderTranslatorImpl {
  readonly provider  = "veo" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;

    // Full hero — complete identity, pose, action, not just "the primary subject"
    const hero        = buildHeroSection(spec);
    const environment = buildEnvironmentSection(spec);
    const lighting    = buildLightingSection(spec);
    const emotion     = buildVisibleEmotionSection(spec);

    const opening  = `The scene opens on: ${hero || "the primary subject"}.`;
    const setting  = environment ? `Set in: ${environment}.` : "";
    const light    = lighting    ? `Lighting: ${lighting}.`  : "";
    const feeling  = emotion     ? `The scene expresses: ${emotion}.` : "";
    const quality  = `${VEO_QUALITY_BOOSTERS.join(", ")}.`;

    let finalPrompt = [opening, setting, light, feeling, quality]
      .filter(s => s.trim().length > 2)
      .join(" ");

    if (finalPrompt.length > VEO_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, VEO_LIMITS.maxLength - 3) + "...";
    }

    const qualityScore = validateAndScore(finalPrompt, undefined, optimized, VEO_LIMITS);

    return {
      meta: {
        provider: "veo", providerVersion: VEO_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt,
        orderedSections: ["hero_opening", "environment", "lighting", "emotion", "quality"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "temporal",
      },
      quality: qualityScore,
    };
  }
}

export const veoTranslator = new VeoTranslator();
