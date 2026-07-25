import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import {
  buildHeroSection,
  buildVisibleEmotionSection,
  buildCompositionCameraSection,
  buildLightingSection,
  buildEnvironmentSection,
  buildSupportingSection,
  buildMarketingSection,
  buildTypographySection,
  buildAdNarrativeSection,
  getNegatives,
  getRenderingDirective,
  estimateTokens,
} from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { GEMINI_QUALITY_SENTENCE, GEMINI_QUALITY_BOOSTERS, GEMINI_QUALITY_ANTI_PATTERNS, GEMINI_LIMITS } from "./quality";

// Phase 10.4G — Gemini Semantic Compiler.
// Natural language prose. Complete structured sections without compression.
// Gemini responds well to explicit scene setup before detail — kept.
// All section builders now read previously-dead fields.

const TRANSLATOR_VERSION = "2.0.0";

class GeminiTranslator implements ProviderTranslatorImpl {
  readonly provider  = "gemini" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;
    const sections: string[] = [];

    // Phase 10.4J — Story context first: narrative intent before visual detail
    const adNarrative = buildAdNarrativeSection(spec);
    if (adNarrative) sections.push(`Story context: ${adNarrative}.`);

    // Gemini opener — explicit framing helps the model
    const hero = buildHeroSection(spec);
    if (hero) sections.push(`Create a professional advertising photograph: ${hero}.`);

    // Visible emotion — psychology as visible behaviour
    const emotion = buildVisibleEmotionSection(spec);
    if (emotion) sections.push(`Emotional direction: ${emotion}.`);

    // Supporting subjects — full cast with relationships
    const supporting = buildSupportingSection(spec);
    if (supporting) sections.push(`Scene structure: ${supporting}`);

    // Composition and camera — all 9 fields now
    const compCam = buildCompositionCameraSection(spec);
    if (compCam) sections.push(`Composition and camera: ${compCam}.`);

    // Lighting — all 5 fields
    const lighting = buildLightingSection(spec);
    if (lighting) sections.push(`Lighting: ${lighting}.`);

    // Environment — layered with Foreground/Midground/Background labels
    const environment = buildEnvironmentSection(spec);
    if (environment) sections.push(`Setting: ${environment}.`);

    // Marketing — all 9 fields, never brief
    const marketing = buildMarketingSection(spec);
    if (marketing) sections.push(`${marketing}.`);

    // Typography — all 6 zones
    const typo = buildTypographySection(spec);
    if (typo) sections.push(`Typography zones: ${typo}.`);

    // Rendering + quality
    const renderingDir = getRenderingDirective(optimized);
    sections.push(
      `Style: ${GEMINI_QUALITY_BOOSTERS.join(", ")}${renderingDir ? `, ${renderingDir}` : ""}.`
    );

    // [Indian-default / realism fix] standalone sentence, unconditional —
    // mirrors how OPENAI_QUALITY_SENTENCE is appended in openai/translator.ts.
    sections.push(GEMINI_QUALITY_SENTENCE);

    // Negatives — includes brandRules.forbiddenElements now
    const negatives = getNegatives(optimized);
    if (negatives) {
      sections.push(`Exclude: ${negatives}, ${GEMINI_QUALITY_ANTI_PATTERNS.join(", ")}.`);
    }

    let finalPrompt = sections.filter(Boolean).join(" ");
    if (finalPrompt.length > GEMINI_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, GEMINI_LIMITS.maxLength - 3) + "...";
    }

    const quality = validateAndScore(finalPrompt, undefined, optimized, GEMINI_LIMITS);

    return {
      meta: {
        provider: "gemini", providerVersion: GEMINI_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt,
        orderedSections: ["hero", "emotion", "supporting", "composition", "lighting", "environment", "marketing", "typography", "quality", "negatives"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "prose",
      },
      quality,
    };
  }
}

export const geminiTranslator = new GeminiTranslator();
