import type { OptimizedPromptSpecification } from "../../prompt-optimizer/types";
import type { ProviderPromptQuality } from "../types";

// Shared validation for all provider translators.
// Checks prompt completeness, health, and generates quality scores.

export interface ProviderLimits {
  maxLength:          number;   // max character count for the final prompt
  maxNegativeLength?: number;   // max for separate negative prompt (if supported)
  supportsNegative:   boolean;
  supportsTypography: boolean;  // can this provider render text in images?
  isVideoProvider:    boolean;
}

export function validateAndScore(
  finalPrompt: string,
  negativePrompt: string | undefined,
  optimized: OptimizedPromptSpecification,
  limits: ProviderLimits
): ProviderPromptQuality {
  const warnings: string[] = [];
  const spec = optimized.optimizedSpec;

  // Completeness checks
  let completenessScore = 100;
  if (!finalPrompt.includes(spec.hero.heroSubject.value?.slice(0, 20) ?? "")) {
    completenessScore -= 20;
    warnings.push("Hero subject may not be adequately represented in the final prompt");
  }
  if (finalPrompt.length < 100) {
    completenessScore -= 20;
    warnings.push("Prompt is very short — critical context may be missing");
  }
  if (!negativePrompt && !finalPrompt.toLowerCase().includes("avoid") && !finalPrompt.toLowerCase().includes("without")) {
    completenessScore -= 10;
    warnings.push("No negative constraints detected in prompt");
  }
  if (spec.rendering.photorealismLevel.value !== "unknown" && !finalPrompt.toLowerCase().match(/photorealistic|realistic|quality/)) {
    completenessScore -= 5;
    warnings.push("Rendering quality intent may not be in the prompt");
  }

  // Health checks
  let healthScore = 100;
  if (finalPrompt.length > limits.maxLength) {
    healthScore -= 25;
    warnings.push(`Prompt exceeds provider limit of ${limits.maxLength} chars (current: ${finalPrompt.length})`);
  }
  if (negativePrompt && limits.maxNegativeLength && negativePrompt.length > limits.maxNegativeLength) {
    healthScore -= 10;
    warnings.push(`Negative prompt exceeds limit of ${limits.maxNegativeLength} chars`);
  }
  // Check for broken formatting artifacts
  if (finalPrompt.includes("[scene.") || finalPrompt.includes("[hero.") || finalPrompt.includes("[marketing.")) {
    healthScore -= 15;
    warnings.push("Prompt contains raw field reference keys — compression was incomplete");
  }

  // Translation confidence from optimization score
  const translationConfidence = Math.round(
    (optimized.quality.promptReadinessScore * 0.7) + (completenessScore * 0.3)
  );

  // Estimated quality from rendering priorities
  const luxuryPriority = optimized.optimizedRendering.luxuryPriority;
  const photoPriority  = optimized.optimizedRendering.photorealismPriority;
  const estimatedQuality = Math.round((luxuryPriority * 0.4) + (photoPriority * 0.4) + (completenessScore * 0.2));

  return {
    translationConfidence: Math.min(100, Math.max(0, translationConfidence)),
    promptCompleteness:    Math.min(100, Math.max(0, completenessScore)),
    promptHealth:          Math.min(100, Math.max(0, healthScore)),
    estimatedQuality:      Math.min(100, Math.max(0, estimatedQuality)),
    warnings,
  };
}
