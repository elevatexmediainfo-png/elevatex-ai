import type { OptimizedPromptSpecification } from "../prompt-optimizer/types";
import type { SupportedProvider, ProviderPrompt, ProviderTranslatorImpl } from "./types";
import { openaiTranslator }   from "./providers/openai/translator";
import { geminiTranslator }   from "./providers/gemini/translator";
import { fluxTranslator }     from "./providers/flux/translator";
import { ideogramTranslator } from "./providers/ideogram/translator";
import { sdxlTranslator }     from "./providers/stable-diffusion/translator";
import { veoTranslator }      from "./providers/veo/translator";
import { runwayTranslator }   from "./providers/runway/translator";
import { klingTranslator }    from "./providers/kling/translator";

// Phase 13 — Multi-Provider Translation Layer Engine.
// Single responsibility: route an OptimizedPromptSpecification to the correct
// provider translator and return the provider-ready ProviderPrompt.
//
// STRICT RULES:
//   ✗ Never generates images or videos
//   ✗ Never calls provider APIs
//   ✗ Never modifies marketing intent
//   ✗ Never invents objects, copy, or typography
//   ✓ Only translates the structured spec into provider-optimal prompts

// Registry pattern: add a new provider by adding one entry here.
const TRANSLATORS: Record<SupportedProvider, ProviderTranslatorImpl> = {
  openai:           openaiTranslator,
  gemini:           geminiTranslator,
  flux:             fluxTranslator,
  ideogram:         ideogramTranslator,
  stable_diffusion: sdxlTranslator,
  veo:              veoTranslator,
  runway:           runwayTranslator,
  kling:            klingTranslator,
};

/** Translates an OptimizedPromptSpecification into a ProviderPrompt for the specified provider. */
export function translateForProvider(
  optimized: OptimizedPromptSpecification,
  provider: SupportedProvider
): ProviderPrompt {
  const translator = TRANSLATORS[provider];
  if (!translator) {
    throw new Error(`Provider "${provider}" is not supported. Supported: ${Object.keys(TRANSLATORS).join(", ")}`);
  }
  return translator.translate(optimized);
}

/** Translates for ALL supported providers and returns a map. */
export function translateForAllProviders(
  optimized: OptimizedPromptSpecification
): Record<SupportedProvider, ProviderPrompt> {
  const result = {} as Record<SupportedProvider, ProviderPrompt>;
  for (const [provider, translator] of Object.entries(TRANSLATORS)) {
    result[provider as SupportedProvider] = translator.translate(optimized);
  }
  return result;
}

/** Returns the best provider prompt (highest quality score) from all translations. */
export function translateBestProvider(optimized: OptimizedPromptSpecification): { provider: SupportedProvider; prompt: ProviderPrompt } {
  // For image campaigns, default to openai; for video, default to veo
  const isVideo = optimized.optimizedSpec.meta.specId.toLowerCase().includes("video");
  const defaultProvider: SupportedProvider = isVideo ? "veo" : "openai";
  return { provider: defaultProvider, prompt: translateForProvider(optimized, defaultProvider) };
}
