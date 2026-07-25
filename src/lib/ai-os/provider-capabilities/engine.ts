import type { ProviderCapabilityId, ProviderCapability, CapabilityValidationResult } from "./types";
import type { ProviderPrompt } from "../provider-translator/types";
import {
  CAPABILITY_REGISTRY,
  getCapability,
  getSupportedProviders,
  getImageProviders,
  getVideoProviders,
  getReferenceImageProviders,
  getTransparentBackgroundProviders,
  rankByQuality,
} from "./knowledge";
import { validateProviderPrompt, validateAspectRatio, validateOutputFormat } from "./validation";

// Phase 14 — Provider Capability Engine.
// Single entry point for all capability queries and validations.
// STRICT RULES: no prompts, no images, no API calls.

export {
  CAPABILITY_REGISTRY,
  getCapability,
  getSupportedProviders,
  getImageProviders,
  getVideoProviders,
  getReferenceImageProviders,
  getTransparentBackgroundProviders,
  rankByQuality,
};

/** Full validation of a ProviderPrompt against a provider's capabilities. */
export function validatePromptForProvider(
  prompt: ProviderPrompt,
  providerId: ProviderCapabilityId
): CapabilityValidationResult {
  const capability = getCapability(providerId);
  return validateProviderPrompt(prompt, capability);
}

/** Validates a ProviderPrompt against ALL providers and returns a map of results. */
export function validatePromptForAllProviders(
  prompt: ProviderPrompt
): Record<ProviderCapabilityId, CapabilityValidationResult> {
  const result = {} as Record<ProviderCapabilityId, CapabilityValidationResult>;
  for (const provider of getSupportedProviders()) {
    result[provider] = validatePromptForProvider(prompt, provider);
  }
  return result;
}

/** Returns only providers that are compatible with a given prompt (no errors). */
export function getCompatibleProviders(prompt: ProviderPrompt): ProviderCapabilityId[] {
  return getSupportedProviders().filter(id => {
    const result = validatePromptForProvider(prompt, id);
    return result.isCompatible;
  });
}

/** Validates aspect ratio for a provider. */
export function checkAspectRatio(ratio: string, providerId: ProviderCapabilityId): CapabilityValidationResult {
  return validateAspectRatio(ratio, getCapability(providerId));
}

/** Validates output format for a provider. */
export function checkOutputFormat(format: string, providerId: ProviderCapabilityId): CapabilityValidationResult {
  return validateOutputFormat(format, getCapability(providerId));
}

/** Returns a comparison of all providers on a specific capability field. */
export function compareProviders(
  field: keyof ProviderCapability
): Array<{ provider: ProviderCapabilityId; value: unknown; confidence: string }> {
  return getSupportedProviders().map(id => {
    const cap = getCapability(id);
    const capField = cap[field] as { value: unknown; confidence: string } | undefined;
    return {
      provider:   id,
      value:      capField?.value ?? "N/A",
      confidence: capField?.confidence ?? "unknown",
    };
  });
}
