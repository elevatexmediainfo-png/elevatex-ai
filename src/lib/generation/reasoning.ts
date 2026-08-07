import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateReasoningProvider } from "@/lib/providers/reasoning";
import type {
  ReasoningPlanRequest,
  ReasoningProviderId,
  ReasoningPlanResultWithProvider,
  ReasoningReeditRequest,
  ReasoningReeditResultWithProvider,
  ReasoningStoryRequest,
  ReasoningStoryResultWithProvider,
  ReasoningCaptionRequest,
  ReasoningCaptionResultWithProvider,
  ReasoningVisualsRequest,
  ReasoningVisualsResultWithProvider,
  ReasoningAudioRequest,
  ReasoningAudioResultWithProvider,
  ReasoningQualityReviewRequest,
  ReasoningQualityReviewResultWithProvider,
} from "@/lib/providers/reasoning";
import { runGeneration } from "./engine";
import type { GenerationContext } from "./types";

export async function planTimeline(
  req: ReasoningPlanRequest,
  context?: GenerationContext
): Promise<ReasoningPlanResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));

  return runGeneration({
    category: "REASONING",
    operation: "plan_timeline",
    providers,
    invoke: (provider, signal) => provider.plan(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

// Phase 12 Module 9 — same REASONING category/provider priority chain as
// planTimeline() above, a genuinely different call (provider.reEdit(),
// not .plan()) for the SAME underlying capability the app already pays
// for and configures once in Admin → AI Providers.
export async function planReedit(req: ReasoningReeditRequest, context?: GenerationContext): Promise<ReasoningReeditResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));

  return runGeneration({
    category: "REASONING",
    operation: "reedit_clip",
    providers,
    invoke: (provider, signal) => provider.reEdit(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

// AI Video Director (2026-08-07) — 5 new thin wrappers, one per new
// agent, same "list enabled REASONING providers, instantiate, runGeneration
// with a distinct operation label" shape as planTimeline/planReedit above.
// Each `operation` string gives this agent its OWN GenerationLog cost/
// usage entry for free (runGeneration's existing per-call logging — no
// bespoke plumbing needed, confirmed during this feature's planning) —
// real cost visibility into which agent is actually driving spend.
export async function planStory(req: ReasoningStoryRequest, context?: GenerationContext): Promise<ReasoningStoryResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));
  return runGeneration({
    category: "REASONING",
    operation: "director_story_hook_retention",
    providers,
    invoke: (provider, signal) => provider.planStory(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

export async function planDirectorCaptions(req: ReasoningCaptionRequest, context?: GenerationContext): Promise<ReasoningCaptionResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));
  return runGeneration({
    category: "REASONING",
    operation: "director_captions",
    providers,
    invoke: (provider, signal) => provider.planCaptions(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

export async function planVisuals(req: ReasoningVisualsRequest, context?: GenerationContext): Promise<ReasoningVisualsResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));
  return runGeneration({
    category: "REASONING",
    operation: "director_visuals",
    providers,
    invoke: (provider, signal) => provider.planVisuals(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

export async function planAudio(req: ReasoningAudioRequest, context?: GenerationContext): Promise<ReasoningAudioResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));
  return runGeneration({
    category: "REASONING",
    operation: "director_audio",
    providers,
    invoke: (provider, signal) => provider.planAudio(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

export async function reviewQuality(req: ReasoningQualityReviewRequest, context?: GenerationContext): Promise<ReasoningQualityReviewResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));
  return runGeneration({
    category: "REASONING",
    operation: "director_quality_review",
    providers,
    invoke: (provider, signal) => provider.reviewQuality(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}
