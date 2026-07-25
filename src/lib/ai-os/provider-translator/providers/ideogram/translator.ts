import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import {
  buildHeroSection,
  buildLightingSection,
  buildEnvironmentSection,
  buildMarketingSection,
  buildTypographySection,
  buildAdNarrativeSection,
  getNegatives,
  getRenderingDirective,
  estimateTokens,
} from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { IDEOGRAM_QUALITY_BOOSTERS, IDEOGRAM_QUALITY_ANTI_PATTERNS, IDEOGRAM_LIMITS } from "./quality";

// Phase 10.4G — Ideogram Semantic Compiler.
// Ideogram specialises in text-in-image generation.
// Typography zones are the PRIORITY section — all 6 zones preserved.
// Hero, lighting, and environment all use the full richer builders now.

const TRANSLATOR_VERSION = "2.0.0";

class IdeogramTranslator implements ProviderTranslatorImpl {
  readonly provider  = "ideogram" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;
    const sections: string[] = [];

    // Phase 10.4J — Story context before hero
    const adNarrative = buildAdNarrativeSection(spec);
    if (adNarrative) sections.push(`Story context: ${adNarrative}.`);

    // Hero — full identity, pose, action
    const hero = buildHeroSection(spec);
    if (hero) sections.push(hero + ".");

    // Lighting — all 5 fields
    const lighting = buildLightingSection(spec);
    if (lighting) sections.push(`Lighting: ${lighting}.`);

    // Environment — layered with Foreground/Midground/Background
    const environment = buildEnvironmentSection(spec);
    if (environment) sections.push(environment + ".");

    // Marketing — all 9 fields (never brief)
    const marketing = buildMarketingSection(spec);
    if (marketing) sections.push(`${marketing}.`);

    // Typography zones — CRITICAL for Ideogram — all 6 zones including
    // reservedBodyArea and reservedDisclaimerArea (were dead before).
    const typo = buildTypographySection(spec);
    if (typo) sections.push(`Text zones: ${typo}.`);

    // Rendering — all 6 rendering fields
    const renderingDir = getRenderingDirective(optimized);
    sections.push(
      `${IDEOGRAM_QUALITY_BOOSTERS.join(", ")}${renderingDir ? `, ${renderingDir}` : ""}.`
    );

    // Negatives — includes brandRules.forbiddenElements now
    const negatives = getNegatives(optimized);
    if (negatives) {
      sections.push(`Avoid: ${negatives}, ${IDEOGRAM_QUALITY_ANTI_PATTERNS.join(", ")}.`);
    }

    let finalPrompt = sections.filter(Boolean).join(" ");
    if (finalPrompt.length > IDEOGRAM_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, IDEOGRAM_LIMITS.maxLength - 3) + "...";
    }

    const quality = validateAndScore(finalPrompt, undefined, optimized, IDEOGRAM_LIMITS);

    return {
      meta: {
        provider: "ideogram", providerVersion: IDEOGRAM_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt,
        orderedSections: ["hero", "lighting", "environment", "marketing", "typography", "quality", "negatives"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "prose",
      },
      quality,
    };
  }
}

export const ideogramTranslator = new IdeogramTranslator();
