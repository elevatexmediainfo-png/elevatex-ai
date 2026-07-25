import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import { estimateTokens, getNegatives, buildAdNarrativeTags } from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { FLUX_QUALITY_BOOSTERS, FLUX_QUALITY_ANTI_PATTERNS, FLUX_LIMITS } from "./quality";

// Phase 10.4G — Flux Semantic Compiler.
// Format: comma-separated tag style. Flux responds to dense descriptors.
// Phase 10.4G change: heroSubject is no longer truncated to 60 chars —
// the full first phrase is kept. Tags stay within the 512-char budget by
// being selective about which fields to include, not by truncating the ones
// we include. Quality of individual tags > quantity of tags.

const TRANSLATOR_VERSION = "2.0.0";

/** Extracts the first meaningful phrase from a prose field (before comma/period). */
function tag(field: { value: string } | undefined): string {
  if (!field || field.value === "unknown") return "";
  return field.value.split(/[,.]/, 1)[0]!.trim();
}

class FluxTranslator implements ProviderTranslatorImpl {
  readonly provider  = "flux" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;
    const tags: string[] = [];

    // Phase 10.4J — Ad narrative enrichment tags (story archetype + context)
    const adTags = buildAdNarrativeTags(spec);
    if (adTags) tags.push(adTags);

    // Hero — full first phrase, not artificially capped to 60 chars
    const heroSubject = tag(spec.hero.heroSubject);
    const heroDetails = tag(spec.hero.heroDetails);
    if (heroSubject) tags.push(heroSubject);           // preserve complete phrase
    if (heroDetails && heroDetails !== heroSubject) tags.push(heroDetails);

    // Composition + camera
    const comp      = tag(spec.composition.primaryComposition);
    const camHeight = tag(spec.camera.cameraHeight);   // was dead — now included
    const lens      = tag(spec.camera.lensIntent);
    if (comp)      tags.push(comp.replace(/_/g, " "));
    if (camHeight) tags.push(camHeight.replace(/_/g, " "));
    if (lens)      tags.push(lens.replace(/_/g, " "));

    // Lighting
    const moodLight = tag(spec.lighting.moodLighting);
    const shadow    = tag(spec.lighting.shadowStyle);
    if (moodLight) tags.push(moodLight.replace(/_/g, " "));
    if (shadow)    tags.push(shadow.replace(/_/g, " "));

    // Environment
    const envType = tag(spec.environment.environmentType);
    if (envType) tags.push(envType.replace(/_/g, " "));

    // Rendering
    const rendering = tag(spec.rendering.photorealismLevel);
    if (rendering) tags.push(rendering.replace(/_/g, " "));
    tags.push(...FLUX_QUALITY_BOOSTERS);

    let finalPrompt = tags.filter(Boolean).join(", ");
    if (finalPrompt.length > FLUX_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, FLUX_LIMITS.maxLength);
    }

    // Negative prompt
    const negatives = getNegatives(optimized);
    const negativePrompt = [negatives, FLUX_QUALITY_ANTI_PATTERNS.join(", ")]
      .filter(Boolean)
      .join(", ")
      .slice(0, FLUX_LIMITS.maxNegativeLength);

    const quality = validateAndScore(finalPrompt, negativePrompt, optimized, FLUX_LIMITS);

    return {
      meta: {
        provider: "flux", providerVersion: FLUX_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt, negativePrompt,
        orderedSections: ["hero", "composition", "camera", "lighting", "environment", "quality"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "tags",
      },
      quality,
    };
  }
}

export const fluxTranslator = new FluxTranslator();
