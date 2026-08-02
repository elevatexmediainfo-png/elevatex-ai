import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateImageProvider } from "@/lib/providers/image";
import type { ImageGenerateRequest, ImageGenerateResultWithProvider, ImageProviderId } from "@/lib/providers/image";
import { reorderProvidersByPreference, runGeneration } from "./engine";
import type { GenerationContext } from "./types";

// Generation Engine entry point for image generation — used for per-scene
// images ("scene_image"), the legacy project thumbnail ("thumbnail"),
// (Milestone 14) standalone AI Image/Social Media/Marketing Creative
// generation ("creative_image"), (AI Film) character variation portraits
// ("film_character"), and (Phase 12 Module 5) AI Auto-Editor generated
// b-roll stills ("ai_broll_image"). Returns ImageGenerateResultWithProvider
// (not the bare ImageGenerateResult) — every caller must be able to see
// which provider actually served the result and check it against
// MOCK_PROVIDER_ID before treating it as real (2026-07-24, same fix
// already applied to generateVoiceover()).
export async function generateImage(
  req: ImageGenerateRequest,
  operation: "thumbnail" | "scene_image" | "creative_image" | "film_character" | "ai_broll_image" | "film_scene_preview" = "thumbnail",
  context?: GenerationContext,
  preferredProviderId?: string,
  /**
   * Marketing Templates' admin-locked Primary/Fallback (2026-08-02) — unlike
   * preferredProviderId (which only reorders, leaving the rest of the
   * enabled category as a silent extended cascade), this restricts the
   * chain to EXACTLY these ids, in this order. Every other existing caller
   * omits it and is completely unaffected — runGeneration() already throws
   * AllProvidersFailedError on an empty chain, so "Primary -> Fallback ->
   * Error" falls out of this filter with no engine changes.
   */
  allowedProviderIds?: string[]
): Promise<ImageGenerateResultWithProvider> {
  const priority = await listEnabledProviderConfigs("IMAGE");
  const scoped = allowedProviderIds ? priority.filter((id) => allowedProviderIds.includes(id)) : priority;
  const providers = await Promise.all(scoped.map((id) => instantiateImageProvider(id as ImageProviderId)));
  const ordered = reorderProvidersByPreference(providers, preferredProviderId);

  return runGeneration({
    category: "IMAGE",
    operation,
    providers: ordered,
    invoke: (provider, signal) => provider.generate(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}
