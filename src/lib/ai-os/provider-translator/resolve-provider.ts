// Phase 10.4A — Provider ID resolution for Phase 13 integration.
//
// The platform uses one set of provider ID strings in the generation engine
// (e.g. "openai_images", "flux") and a different set in Phase 13's
// translateForProvider() (e.g. "openai", "flux"). This module is the single
// place that bridges the two naming conventions.
//
// Callers:
//   enhance-prompt/route.ts — resolves the lead provider before calling
//   translateForProvider() so Phase 13 uses the correct translator.

import type { SupportedProvider } from "./types";

// Maps the platform's internal provider IDs (from listEnabledProviderConfigs
// / resolvePromptAdapter) to the SupportedProvider strings Phase 13 expects.
//
// [gemini_images routing fix] The real Gemini/Imagen image providers
// (providers/image/index.ts's IMAGE_PROVIDER_IDS) register as "gemini_images"
// and "imagen" — this map only had the bare "gemini" placeholder, so any
// live Gemini request silently fell back to DEFAULT_PROVIDER ("openai")
// whenever this modern path is active. Same root-cause class as the
// identical bug fixed in lib/prompt-os/adapters/index.ts (the currently-
// active legacy pipeline) — fixed here too so this path is correct the day
// PROVIDER_PROMPT_ENABLED is turned on.
const LEGACY_ID_MAP: Readonly<Record<string, SupportedProvider>> = {
  openai_images:    "openai",
  flux:             "flux",
  ideogram:         "ideogram",
  gemini:           "gemini",
  gemini_images:    "gemini",
  imagen:           "gemini",
  stable_diffusion: "stable_diffusion",
};

const DEFAULT_PROVIDER: SupportedProvider = "openai";

/**
 * Map a platform provider ID (e.g. "openai_images", "flux") to the
 * SupportedProvider string used by Phase 13's translateForProvider().
 *
 * Falls back to "openai" for any unrecognised or absent ID so the pipeline
 * never breaks when a new provider is added before the map is updated.
 */
export function resolveProviderForTranslation(
  legacyId: string | null | undefined,
): SupportedProvider {
  if (!legacyId) return DEFAULT_PROVIDER;
  return LEGACY_ID_MAP[legacyId] ?? DEFAULT_PROVIDER;
}
