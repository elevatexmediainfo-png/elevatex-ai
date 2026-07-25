import type { GenerationRequest, GenerationCost } from "./types";
import type { ProviderCapabilityId } from "../provider-capabilities/types";

// Phase 15 — Cost estimation and tracking.
// Estimates generation cost before execution and tracks actual cost after.

// Cost estimates in USD per image (approximate, based on public pricing as of 2026-07)
const COST_PER_IMAGE_USD: Record<ProviderCapabilityId, Record<string, number>> = {
  openai:           { low: 0.01, medium: 0.03, high: 0.06, auto: 0.04, default: 0.04 },
  gemini:           { standard: 0.02, hd: 0.04, default: 0.03 },
  flux:             { default: 0.003, fast: 0.001, quality: 0.006 },
  ideogram:         { default: 0.006, turbo: 0.002 },
  stable_diffusion: { default: 0.001 },
  veo:              { default: 0.50 },     // video is significantly more expensive
  runway:           { default: 0.35 },
  kling:            { standard: 0.10, high: 0.20, default: 0.10 },
};

// Internal credit cost (1 credit ≈ $0.01 in user-facing pricing)
const CREDITS_PER_GENERATION: Record<ProviderCapabilityId, number> = {
  openai:           5,
  gemini:           4,
  flux:             2,
  ideogram:         3,
  stable_diffusion: 1,
  veo:              50,
  runway:           35,
  kling:            15,
};

/** Estimates the cost of a generation request before execution. */
export function estimateGenerationCost(request: GenerationRequest): GenerationCost {
  const provider = request.capability.id;
  const quality = request.quality ?? "default";
  const model = request.capability.providerVersion.value;

  const tierMap = COST_PER_IMAGE_USD[provider] ?? { default: 0.05 };
  const estimatedCostUsd = tierMap[quality] ?? tierMap["default"] ?? 0.05;
  const creditCost = CREDITS_PER_GENERATION[provider] ?? 5;

  return {
    estimatedCostUsd,
    creditCost,
    billingModel: request.capability.category === "video" ? "per_second" : "per_image",
    provider,
    model,
    quality,
  };
}

/** Updates cost estimate with actual cost from provider response metadata. */
export function resolveActualCost(
  estimate: GenerationCost,
  actualCostUsd?: number
): GenerationCost {
  return { ...estimate, actualCostUsd: actualCostUsd ?? estimate.estimatedCostUsd };
}
