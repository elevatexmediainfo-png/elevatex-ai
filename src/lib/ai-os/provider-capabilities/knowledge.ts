import type { ProviderCapability, ProviderCapabilityId } from "./types";
import { openaiCapability }   from "./providers/openai";
import { geminiCapability }   from "./providers/gemini";
import { fluxCapability }     from "./providers/flux";
import { ideogramCapability } from "./providers/ideogram";
import { sdxlCapability }     from "./providers/stable-diffusion";
import { veoCapability }      from "./providers/veo";
import { runwayCapability }   from "./providers/runway";
import { klingCapability }    from "./providers/kling";

// Phase 14 — Provider Capability Registry.
// This is the single source of truth for every provider's capabilities.
// No provider capability may be hardcoded anywhere outside this module.
// Adding a new provider requires: one capability file + one entry in this registry.

export const CAPABILITY_REGISTRY: Record<ProviderCapabilityId, ProviderCapability> = {
  openai:           openaiCapability,
  gemini:           geminiCapability,
  flux:             fluxCapability,
  ideogram:         ideogramCapability,
  stable_diffusion: sdxlCapability,
  veo:              veoCapability,
  runway:           runwayCapability,
  kling:            klingCapability,
};

/** Returns the capability definition for a given provider. Throws if unknown. */
export function getCapability(provider: ProviderCapabilityId): ProviderCapability {
  const cap = CAPABILITY_REGISTRY[provider];
  if (!cap) throw new Error(`No capability definition for provider "${provider}". Add a file to providers/ and register it in knowledge.ts.`);
  return cap;
}

/** Returns all registered provider IDs. */
export function getSupportedProviders(): ProviderCapabilityId[] {
  return Object.keys(CAPABILITY_REGISTRY) as ProviderCapabilityId[];
}

/** Returns only image generation providers. */
export function getImageProviders(): ProviderCapabilityId[] {
  return getSupportedProviders().filter(id => {
    const cap = CAPABILITY_REGISTRY[id];
    return cap.category === "image" || cap.category === "image_video";
  });
}

/** Returns only video generation providers. */
export function getVideoProviders(): ProviderCapabilityId[] {
  return getSupportedProviders().filter(id => {
    const cap = CAPABILITY_REGISTRY[id];
    return cap.category === "video" || cap.category === "image_video";
  });
}

/** Returns providers that support reference images. */
export function getReferenceImageProviders(): ProviderCapabilityId[] {
  return getSupportedProviders().filter(id => CAPABILITY_REGISTRY[id].referenceImageSupport.value);
}

/** Returns providers that support transparent backgrounds. */
export function getTransparentBackgroundProviders(): ProviderCapabilityId[] {
  return getSupportedProviders().filter(id => CAPABILITY_REGISTRY[id].transparentBackground.value);
}

/** Returns providers ranked by quality for a specific use case. */
export function rankByQuality(
  useCase: "typography" | "human" | "product" | "medical" | "architecture" | "food" | "luxury"
): Array<{ provider: ProviderCapabilityId; score: number }> {
  const fieldMap: Record<string, keyof ProviderCapability> = {
    typography:   "typographyQuality",
    human:        "humanRenderingQuality",
    product:      "productRenderingQuality",
    medical:      "medicalRenderingQuality",
    architecture: "architectureRenderingQuality",
    food:         "foodRenderingQuality",
    luxury:       "luxuryAdvertisementQuality",
  };
  const field = fieldMap[useCase];
  if (!field) return [];

  return getSupportedProviders()
    .map(id => {
      const cap = CAPABILITY_REGISTRY[id];
      const capField = cap[field] as { value: number };
      return { provider: id, score: typeof capField?.value === "number" ? capField.value : 0 };
    })
    .sort((a, b) => b.score - a.score);
}
