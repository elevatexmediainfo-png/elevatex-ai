import type { OptimizedPromptSpecification } from "../../../prompt-optimizer/types";
import type { ProviderPrompt, ProviderTranslatorImpl } from "../../types";
import { estimateTokens, getNegatives, buildAdNarrativeTags } from "../../shared/section-builders";
import { validateAndScore } from "../../shared/validation";
import { SDXL_QUALITY_BOOSTERS, SDXL_QUALITY_ANTI_PATTERNS, SDXL_LIMITS } from "./quality";

// Phase 10.4G — SDXL Semantic Compiler.
// SDXL uses tag-based prompts with quality boosters at the START.
// Phase 10.4G change: heroSubject uses the full first phrase (no arbitrary
// truncation) — the field itself is already concise from the spec optimizer.

const TRANSLATOR_VERSION = "2.0.0";

/** Extracts the first meaningful phrase from a prose field (before comma/period). */
function tag(field: { value: string } | undefined): string {
  if (!field || field.value === "unknown") return "";
  return field.value.split(/[,.]/, 1)[0]!.trim().toLowerCase().replace(/\s+/g, " ");
}

class SDXLTranslator implements ProviderTranslatorImpl {
  readonly provider  = "stable_diffusion" as const;
  readonly version   = TRANSLATOR_VERSION;

  translate(optimized: OptimizedPromptSpecification): ProviderPrompt {
    const spec = optimized.optimizedSpec;

    // SDXL: quality boosters FIRST, then subject, then environment details
    const tags: string[] = [...SDXL_QUALITY_BOOSTERS];

    // Phase 10.4J — Ad narrative enrichment tags
    const adTags = buildAdNarrativeTags(spec);
    if (adTags) tags.push(adTags);

    // Hero — full first phrase (not toTag-truncated beyond comma/period)
    const hero = tag(spec.hero.heroSubject);
    if (hero) tags.push(hero);

    // Lighting mood
    const lighting = tag(spec.lighting.moodLighting);
    if (lighting) tags.push(lighting);

    // Composition
    const comp = tag(spec.composition.primaryComposition);
    if (comp) tags.push(comp);

    // Environment
    const env = tag(spec.environment.environmentType);
    if (env) tags.push(env);

    let finalPrompt = tags.filter(Boolean).join(", ");
    if (finalPrompt.length > SDXL_LIMITS.maxLength) {
      finalPrompt = finalPrompt.slice(0, SDXL_LIMITS.maxLength);
    }

    // Negative prompt — deduplicated via getNegatives
    const negatives = getNegatives(optimized);
    const negativePrompt = [
      ...SDXL_QUALITY_ANTI_PATTERNS,
      ...negatives.split(",").map(s => s.trim()).slice(0, 5),
    ]
      .filter(Boolean)
      .join(", ")
      .slice(0, SDXL_LIMITS.maxNegativeLength);

    const quality = validateAndScore(finalPrompt, negativePrompt, optimized, SDXL_LIMITS);

    return {
      meta: {
        provider: "stable_diffusion", providerVersion: SDXL_LIMITS.providerVersion,
        translatorVersion: TRANSLATOR_VERSION, createdAt: new Date().toISOString(),
        sourceOptimizationId: optimized.meta.optimizationId, sourceSpecId: spec.meta.specId,
      },
      body: {
        finalPrompt, negativePrompt,
        orderedSections: ["quality", "hero", "lighting", "composition", "environment"],
        estimatedPromptLength: finalPrompt.length,
        estimatedTokenCount:   estimateTokens(finalPrompt),
        formatStyle: "tags",
      },
      quality,
    };
  }
}

export const sdxlTranslator = new SDXLTranslator();
