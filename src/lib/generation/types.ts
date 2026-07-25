// Shared types for the Generation Engine — the orchestration layer that sits
// in front of the 4 generation provider categories (LLM/Image/Voice/Video)
// and adds failover, retry, timeout, cost tracking, health monitoring, and
// usage analytics on top of them, generically, regardless of category.

export type GenerationCategory = "LLM" | "IMAGE" | "VOICE" | "VIDEO" | "TRANSCRIPTION" | "VIDEO_UNDERSTANDING" | "REASONING";

// The one id every category's fallback adapter uses (see each
// providers/*/mock.provider.ts) — the shared, canonical way for a caller to
// tell "this result came from the real vendor" apart from "the whole
// failover chain was exhausted and this is a placeholder." Centralized here
// instead of the literal string "mock" being re-typed at every charge-site,
// so a future rename can't silently desync from runGeneration()'s own check.
export const MOCK_PROVIDER_ID = "mock";

// Every category-specific provider interface (LLMProvider, ImageProvider,
// VoiceProvider, VideoProvider) extends this — the "common interface every
// provider exposes" the engine relies on to do priority ordering, health
// checks, and logging without needing to know which category it's running.
export interface GenerationProvider {
  readonly id: string;
  readonly category: GenerationCategory;
  /** Vendor model id actually in use for this provider instance (Cost Management's per-model breakdown), when the category has a model concept. */
  readonly model?: string;
}

export interface GenerationUsage {
  tokens?: number;
  characters?: number;
  seconds?: number;
  images?: number;
}

export interface GenerationContext {
  videoProjectId?: string;
  userId?: string;
  /** Set for scene-level generation calls so usage analytics can attribute cost/latency per scene. */
  sceneId?: string;
  /** Milestone 14 — set for standalone content-type generation (AI Image/Social Media/Marketing Creative), mirroring videoProjectId. Never both at once. */
  creativeProjectId?: string;
}

export interface ProviderAttemptSummary {
  providerId: string;
  attempts: number;
  error: string;
}

// Thrown when every provider in a category's (health-filtered) priority
// chain has exhausted its retries. Callers (the per-category wrappers, the
// queue processor) catch this the same way they'd catch any single
// provider's error — the failover/retry machinery is invisible to them.
export class AllProvidersFailedError extends Error {
  readonly category: GenerationCategory;
  readonly operation: string;
  readonly attempts: ProviderAttemptSummary[];

  constructor(category: GenerationCategory, operation: string, attempts: ProviderAttemptSummary[]) {
    const detail = attempts.length
      ? attempts.map((a) => `${a.providerId} (${a.attempts} attempt(s): ${a.error})`).join("; ")
      : "no providers configured";
    super(`All ${category} providers failed for "${operation}": ${detail}`);
    this.name = "AllProvidersFailedError";
    this.category = category;
    this.operation = operation;
    this.attempts = attempts;
  }
}

// Real incident (2026-07-24) — "Couldn't enhance your prompt" turned out to
// be a genuine simultaneous outage of BOTH configured LLM providers
// (Gemini: real 503 "high demand"/transient; OpenAI: real 429
// "insufficient_quota"/persistent billing exhaustion, confirmed via 2 live
// attempts ~90s apart hitting the identical real errors both times) — not a
// code bug. This is the honest generic-message replacement: distinguishes
// "wait and retry" from "an admin needs to act" WITHOUT leaking raw vendor
// error bodies to the end user. Callers still see AllProvidersFailedError
// itself if they want the raw per-provider detail (e.g. server logs).
export function describeAllProvidersFailure(err: AllProvidersFailedError): string {
  if (err.attempts.length === 0) {
    return "No AI provider is currently configured for this. Check Admin → AI Providers.";
  }
  const quotaExhausted = err.attempts.some((a) => /insufficient_quota|429/i.test(a.error));
  const allTransient = err.attempts.every((a) => /5\d\d|UNAVAILABLE|overloaded|high demand|timeout/i.test(a.error));
  if (quotaExhausted) {
    return "AI capacity is temporarily exhausted (a provider's billing/quota limit was hit) — an admin needs to check billing in Admin → AI Providers. Please try again shortly.";
  }
  if (allTransient) {
    return "AI providers are temporarily overloaded — please try again in a minute.";
  }
  return "Couldn't complete this AI request right now. Please try again.";
}

export interface GenerationPolicy {
  retryMaxAttempts: number;
  retryBackoffMs: number;
  timeoutMs: number;
  healthFailureThreshold: number;
  healthCooldownMs: number;
}

// Real progress feedback (2026-07-25) — a real, multi-minute generation
// (found live: a FILM scene that tried 2 providers and one timed-out retry,
// ~10 real minutes total) looks identical to a hang with nothing reporting
// what's actually happening between "started" and "finished." runGeneration()
// fires this at each real attempt boundary; a caller that cares (FILM's
// per-scene generation, so far — every other category/flow is unaffected,
// this is purely additive) can persist it somewhere pollable. Optional and
// synchronous by design — callers needing to await a DB write use their own
// fire-and-forget/queueing, the engine itself never blocks on this.
export interface GenerationProgressEvent {
  providerId: string;
  attempt: number;
  maxAttempts: number;
  phase: "attempt_start" | "attempt_failed" | "provider_exhausted";
  error?: string;
}
