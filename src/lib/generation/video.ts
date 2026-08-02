import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateVideoProvider } from "@/lib/providers/video";
import type {
  VideoComposeRequest,
  VideoMergeRequest,
  VideoProviderId,
  VideoRenderRequest,
  VideoRenderResultWithProvider,
} from "@/lib/providers/video";
import { reorderProvidersByPreference, runGeneration } from "./engine";
import type { GenerationContext, GenerationProgressEvent } from "./types";
import { assertWithinVideoDurationCap } from "@/lib/video-generation-limits";
import type { VideoProvider } from "@/lib/providers/video";

// Extracted as a standalone pure function (2026-07-25) specifically so this
// can be unit-tested directly against real provider instances (Sora's real
// [4, 8, 12] restriction) without mocking listEnabledProviderConfigs/DB
// instantiation just to exercise the filtering logic itself. See
// VideoProvider.supportedDurationsSeconds's own comment for the full context.
export function filterByDurationSupport<P extends VideoProvider>(providers: P[], durationSeconds: number): P[] {
  return providers.filter((p) => !p.supportedDurationsSeconds || p.supportedDurationsSeconds.includes(durationSeconds));
}

// Generation Engine entry point for video rendering — replaces direct
// getVideoProvider() calls in the queue processor. `operation` distinguishes
// scene renders from the (legacy) project-level preview/master passes in
// usage analytics, since they're separate provider calls with different cost.
//
// preferredProviderId (2026-07-24) — the user-facing video-provider
// selector. Mirrors generateImage()'s existing preferredProviderId param
// exactly: reorderProvidersByPreference() moves the requested provider to
// the front of the chain but leaves the rest of the (health-filtered,
// enabled) chain intact — a deliberate "fall back to another enabled
// provider with a notice" behavior (confirmed with the founder before
// building), not a hard restriction to exactly one provider. Callers can
// tell whether a fallback actually happened by comparing this parameter
// against the result's own providerId.
export async function renderVideo(
  req: VideoRenderRequest,
  // "creative_video" — AI Video Phase 2 — mirrors generateImage()'s
  // "creative_image": a standalone content-type generation, not tied to a
  // VideoProject/Scene. "ai_broll_video" — Phase 12 Module 5 — AI
  // Auto-Editor generated b-roll clips (only when TASK 3's prompt
  // decides motion is genuinely essential; image is the cheaper default).
  operation: "preview_render" | "master_render" | "scene_render" | "creative_video" | "ai_broll_video",
  context?: GenerationContext,
  preferredProviderId?: string,
  /** Real progress feedback (2026-07-25) — see GenerationProgressEvent's own comment. Optional; every existing caller that doesn't pass one is unaffected. */
  onProgress?: (event: GenerationProgressEvent) => void | Promise<void>,
  /**
   * Marketing Templates' admin-locked Primary/Fallback (2026-08-02) —
   * mirrors generateImage()'s identical param exactly: restricts the chain
   * to EXACTLY these ids, in this order, instead of preferredProviderId's
   * reorder-then-cascade-through-everything-else behavior. Every other
   * existing caller omits it and is unaffected.
   */
  allowedProviderIds?: string[]
): Promise<VideoRenderResultWithProvider> {
  // Hard cap (2026-07-24) — enforced here so every real caller (Quick
  // Video, GENERATED, FILM, Marketing Templates, AI Auto-Editor b-roll)
  // gets it for free, not just the ones remembering to check first. Real
  // vendor per-call caps (Veo 8s, Seedance 15s) already keep a single call
  // well under this — this mainly guards a future caller/provider that
  // might not.
  assertWithinVideoDurationCap(req.durationSeconds);

  const priority = await listEnabledProviderConfigs("VIDEO");
  const scoped = allowedProviderIds ? priority.filter((id) => allowedProviderIds.includes(id)) : priority;
  const providers = await Promise.all(scoped.map((id) => instantiateVideoProvider(id as VideoProviderId)));

  // Real bug fix (2026-07-25) — a provider with a confirmed, fixed set of
  // supported durations (e.g. Sora's 4/8/12s only) is a guaranteed, wasted
  // failure for any other requested duration (FILM's 10/20s, a GENERATED
  // scene's arbitrary script-driven length) — every attempt through it adds
  // real latency for zero chance of success. Filtered out here, before the
  // engine ever attempts it, rather than letting it fail and move on. Every
  // provider with no declared restriction (the common case) is unaffected.
  const compatible = filterByDurationSupport(providers, req.durationSeconds);

  const ordered = reorderProvidersByPreference(compatible, preferredProviderId);

  return runGeneration({
    category: "VIDEO",
    operation,
    providers: ordered,
    invoke: (provider) => provider.render(req),
    getUsage: (result) => result.usage,
    context,
    onProgress,
  });
}

// Scenes are rendered once at master quality; merge produces BOTH the
// watermarked preview and the clean master from the same scene clips, so a
// scene never has to be generated twice. Routed through the same engine as
// renderVideo() — merge gets failover/retry/timeout/cost/health/analytics
// for free, with no new orchestration code.
export async function mergeSceneVideos(
  req: VideoMergeRequest,
  operation: "merge_preview" | "merge_master",
  context?: GenerationContext
): Promise<VideoRenderResultWithProvider> {
  const priority = await listEnabledProviderConfigs("VIDEO");
  const providers = await Promise.all(priority.map((id) => instantiateVideoProvider(id as VideoProviderId)));

  return runGeneration({
    category: "VIDEO",
    operation,
    providers,
    invoke: (provider) => provider.mergeScenes(req),
    getUsage: (result) => result.usage,
    context,
  });
}

// Milestone 9 Export System — a new generation operation through the SAME
// engine (failover/retry/timeout/cost/health/analytics all apply for free),
// not a parallel bespoke export pipeline.
export async function composeTimeline(
  req: VideoComposeRequest,
  context?: GenerationContext
): Promise<VideoRenderResultWithProvider> {
  const priority = await listEnabledProviderConfigs("VIDEO");
  const providers = await Promise.all(priority.map((id) => instantiateVideoProvider(id as VideoProviderId)));

  return runGeneration({
    category: "VIDEO",
    operation: "compose_timeline",
    providers,
    invoke: (provider) => provider.composeTimeline(req),
    getUsage: (result) => result.usage,
    context,
  });
}
