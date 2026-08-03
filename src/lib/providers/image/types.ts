import type { GenerationProvider } from "@/lib/generation/types";

export interface ImageGenerateRequest {
  prompt: string;
  /** Things to steer the image away from. Supported by some adapters (e.g. Flux on Replicate); silently ignored where the vendor API has no such parameter. */
  negativePrompt?: string;
  // Widened (2026-08-03) for Marketing Templates' expanded IMAGE layout set
  // — video/types.ts's own aspectRatio union stays at the original 3 on
  // purpose (VIDEO output wasn't widened; see aspect-ratios.ts's comment).
  aspectRatio:
    | "RATIO_9_16"
    | "RATIO_1_1"
    | "RATIO_16_9"
    | "RATIO_4_5"
    | "RATIO_3_4"
    | "RATIO_2_3"
    | "RATIO_3_2"
    | "RATIO_4_3";
  /**
   * AI Film character variations (2026-07-12) — an existing image to condition
   * generation on (Gemini's multimodal "text-and-image-to-image" editing input,
   * confirmed against Google's own docs: up to 4 reference images supported for
   * character consistency). Used to make a character's 2nd variation the SAME
   * person as the 1st, not an independently-sampled different person. Mirrors
   * VideoRenderRequest.startImage's exact shape/convention. Silently ignored by
   * adapters with no image-conditioning support (same "unsupported where absent"
   * contract negativePrompt already has) — those fall back to an independent
   * text-only sample.
   */
  referenceImage?: { mimeType: string; data: string };
  /**
   * Marketing Templates (2026-07-24) — the multi-image sibling of
   * referenceImage above, for callers that genuinely need more than one
   * conditioning image at once (e.g. a template's own curated reference
   * style AND the user's uploaded logo, together). Additive, not a
   * replacement: existing single-image callers (AI Film variations,
   * engine.ts's Universal Creative Workflow) are unaffected and keep using
   * referenceImage unchanged. When both are somehow set, adapters treat
   * referenceImages as authoritative (referenceImage is merged in as its
   * first element) rather than sending two conflicting conditioning sets.
   * Same "up to 4 images" real API ceiling referenceImage's own comment
   * already documents; adapters with no multi-image support fall back to
   * their existing single-image (or text-only) behavior.
   */
  referenceImages?: { mimeType: string; data: string }[];
}

export interface ImageGenerateResult {
  imageUrl: string;
  providerRef?: string;
  usage?: { images?: number };
}

// generateImage() (lib/generation/image.ts) returns this PLUS a
// `providerId` — attached generically by runGeneration()'s own success
// path (lib/generation/engine.ts), not by any image-specific code — same
// mechanism as VideoRenderResultWithProvider/VoiceGenerateResultWithProvider.
// Added 2026-07-24 for Marketing Templates' own MOCK_PROVIDER_ID check
// (generateImage()'s declared return type never exposed providerId before,
// even though it was always present at runtime — the exact same latent gap
// already found and fixed for VOICE the prior session, flagged but not yet
// fixed for IMAGE in that same audit).
export type ImageGenerateResultWithProvider = ImageGenerateResult & { providerId: string; costUsd?: number };

export interface ImageProvider extends GenerationProvider {
  generate(req: ImageGenerateRequest, signal?: AbortSignal): Promise<ImageGenerateResult>;
}
