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
import { getConfig } from "@/lib/admin/config";
import { logger } from "@/lib/observability/logger";

// Diagnostic instrumentation (2026-08-15, "why is plan_timeline still
// timing out at 60000ms") — engine-attempt-level visibility ONLY: which
// attempt started when, how long it ran before failing, and the
// configured timeout it was racing against. Uses the EXISTING onProgress
// hook runGeneration already supports and calls safely — a throwing
// callback is caught and ignored by the engine itself (see safeProgress,
// engine.ts) — so this cannot alter retry/backoff/timeout behavior even
// if it has a bug. No new AbortController, no new timeout, no change to
// the request itself; purely observational, scoped to plan_timeline only
// (the other 5 wrapper functions below are untouched).
//
// Known limitation, disclosed rather than worked around: the engine's own
// GenerationProgressEvent vocabulary (types.ts) has no "attempt_succeeded"
// phase — only "attempt_start"/"attempt_failed"/"provider_exhausted" — so
// a SUCCESSFUL engine attempt never fires onProgress at all. Success-path
// engine-level visibility (attempt number, latencyMs, model) already
// exists independently via the pre-existing GenerationLog DB write
// (engine.ts's own logEvent() call, status: "SUCCESS") — this
// instrumentation does not duplicate that, only adds what wasn't already
// captured anywhere: real-time start/failure timing and the configured
// timeout value.
export async function planTimeline(
  req: ReasoningPlanRequest,
  context?: GenerationContext
): Promise<ReasoningPlanResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));

  const configuredTimeoutMs = await getConfig("GENERATION_TIMEOUT_MS_REASONING");
  logger.info({ operation: "plan_timeline", configuredTimeoutMs, providerCount: providers.length }, "[reasoning] plan_timeline request starting");

  const attemptStartedAtByKey = new Map<string, number>();
  return runGeneration({
    category: "REASONING",
    operation: "plan_timeline",
    providers,
    invoke: (provider, signal) => provider.plan(req, signal),
    getUsage: (result) => result.usage,
    context,
    onProgress: (event) => {
      const key = `${event.providerId}:${event.attempt}`;
      const model = providers.find((p) => p.id === event.providerId)?.model;
      if (event.phase === "attempt_start") {
        attemptStartedAtByKey.set(key, Date.now());
        logger.info(
          { operation: "plan_timeline", provider: event.providerId, model, engineAttempt: event.attempt, maxEngineAttempts: event.maxAttempts, configuredTimeoutMs },
          "[reasoning] plan_timeline engine attempt starting"
        );
      } else if (event.phase === "attempt_failed") {
        const startedAt = attemptStartedAtByKey.get(key);
        logger.warn(
          {
            operation: "plan_timeline",
            provider: event.providerId,
            model,
            engineAttempt: event.attempt,
            maxEngineAttempts: event.maxAttempts,
            elapsedMs: startedAt != null ? Date.now() - startedAt : undefined,
            outcome: "engine_attempt_failed",
            errorMessage: event.error,
          },
          "[reasoning] plan_timeline engine attempt failed"
        );
      } else if (event.phase === "provider_exhausted") {
        logger.warn({ operation: "plan_timeline", provider: event.providerId, model, maxEngineAttempts: event.maxAttempts, outcome: "provider_exhausted" }, "[reasoning] plan_timeline provider exhausted all engine attempts");
      }
    },
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
