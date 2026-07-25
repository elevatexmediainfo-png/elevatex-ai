import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import {
  buildHeroSection,
  buildEnvironmentSection,
  buildVisibleEmotionSection,
  buildLightingSection,
  estimateTokens,
} from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { KLING_QUALITY_BOOSTERS, KLING_LIMITS } from "./quality";

// Phase 10.4G — Kling Semantic Compiler.
// Natural language, medium length, temporal narrative.
// Hero now uses the full richer builder. Visible emotion replaces the
// raw emotionalGoal string extraction that lost context.

const TRANSLATOR_VERSION = "2.0.0";

class KlingTranslator implements ProviderTranslatorImpl {
  readonly provider  = "kling" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;

    const hero        = buildHeroSection(spec);
    const environment = buildEnvironmentSection(spec);
    const lighting    = buildLightingSection(spec);
    const emotion     = buildVisibleEmotionSection(spec);

    const parts = [
      hero,
      environment,
      lighting ? `Lighting: ${lighting}` : "",
      emotion,
      KLING_QUALITY_BOOSTERS.join(", "),
    ].filter(Boolean);

    let finalPrompt = parts.join(". ");
    if (finalPrompt.length > KLING_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, KLING_LIMITS.maxLength);
    }

    const quality = validateAndScore(finalPrompt, undefined, optimized, KLING_LIMITS);

    return {
      meta: {
        provider: "kling", providerVersion: KLING_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt,
        orderedSections: ["hero", "environment", "lighting", "emotion", "quality"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "temporal",
      },
      quality,
    };
  }
}

export const klingTranslator = new KlingTranslator();
