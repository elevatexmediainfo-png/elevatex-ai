import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import { buildHeroSection, buildVisibleEmotionSection, estimateTokens } from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { RUNWAY_QUALITY_BOOSTERS, RUNWAY_LIMITS } from "./quality";

// Phase 10.4G — Runway Semantic Compiler.
// Short, focused video prompts with motion intent. Hero uses full richer builder.
// Mood is now derived from buildVisibleEmotionSection rather than raw field extraction.

const TRANSLATOR_VERSION = "2.0.0";

class RunwayTranslator implements ProviderTranslatorImpl {
  readonly provider  = "runway" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;

    const hero    = buildHeroSection(spec);
    const emotion = buildVisibleEmotionSection(spec);
    const parts   = [hero, emotion, ...RUNWAY_QUALITY_BOOSTERS].filter(Boolean);

    let finalPrompt = parts.join(", ");
    if (finalPrompt.length > RUNWAY_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, RUNWAY_LIMITS.maxLength);
    }

    const quality = validateAndScore(finalPrompt, undefined, optimized, RUNWAY_LIMITS);

    return {
      meta: {
        provider: "runway", providerVersion: RUNWAY_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt,
        orderedSections: ["hero", "emotion", "quality"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "temporal",
      },
      quality,
    };
  }
}

export const runwayTranslator = new RunwayTranslator();
