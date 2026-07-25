import { describe, expect, it, vi } from "vitest";

import { reorderProvidersByPreference, runGeneration } from "./engine";
import { AllProvidersFailedError, NonRetryableProviderError, type GenerationProvider } from "./types";

interface FakeProvider extends GenerationProvider {
  category: "LLM";
}

function provider(id: string): FakeProvider {
  return { id, category: "LLM" };
}

const FAST_POLICY = {
  retryMaxAttempts: 2,
  retryBackoffMs: 0,
  timeoutMs: 1000,
  healthFailureThreshold: 3,
  healthCooldownMs: 60_000,
};

function baseDeps() {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    recordOutcome: vi.fn().mockResolvedValue(undefined),
    logEvent: vi.fn().mockResolvedValue(undefined),
    estimateCost: vi.fn().mockResolvedValue(0),
    getPolicy: vi.fn().mockResolvedValue(FAST_POLICY),
    getProviderOverrides: vi.fn().mockResolvedValue({}),
    checkBudget: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe("runGeneration", () => {
  it("returns the result from the first provider on success", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockResolvedValue("ok-from-a");

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-from-a");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(a, expect.anything());
    expect(deps.recordOutcome).toHaveBeenCalledWith("LLM", "a", "success", expect.anything());
  });

  it("fails over to the next provider once the first exhausts its retries", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockImplementation(async (p: FakeProvider) => {
      if (p.id === "a") throw new Error("a is down");
      return "ok-from-b";
    });

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-from-b");
    // 2 attempts against "a" (FAST_POLICY.retryMaxAttempts), then 1 against "b".
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(deps.recordOutcome).toHaveBeenCalledWith("LLM", "a", "failure", expect.anything());
    expect(deps.recordOutcome).toHaveBeenCalledWith("LLM", "b", "success", expect.anything());
  });

  it("retries the same provider before giving up on it", async () => {
    const deps = baseDeps();
    const a = provider("a");
    let attempts = 0;
    const invoke = vi.fn().mockImplementation(async () => {
      attempts += 1;
      if (attempts < 2) throw new Error("transient");
      return "ok-on-second-try";
    });

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-on-second-try");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("throws AllProvidersFailedError with a summary per provider when every provider fails", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockRejectedValue(new Error("nope"));

    await expect(
      runGeneration({ category: "LLM", operation: "script", providers: [a, b], invoke, ...deps })
    ).rejects.toThrow(AllProvidersFailedError);

    expect(invoke).toHaveBeenCalledTimes(4); // 2 attempts each
  });

  it("throws immediately when no providers are configured", async () => {
    const deps = baseDeps();
    const invoke = vi.fn();

    await expect(
      runGeneration({ category: "LLM", operation: "script", providers: [], invoke, ...deps })
    ).rejects.toThrow(AllProvidersFailedError);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("skips a provider that health-checking reports unavailable", async () => {
    const deps = baseDeps();
    deps.isAvailable = vi.fn().mockImplementation(async (_cat: string, id: string) => id !== "a");
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockResolvedValue("ok-from-b");

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-from-b");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(b, expect.anything());
  });

  it("falls back to the full chain when every provider is unavailable (no hard outage)", async () => {
    const deps = baseDeps();
    deps.isAvailable = vi.fn().mockResolvedValue(false);
    const a = provider("a");
    const invoke = vi.fn().mockResolvedValue("ok-anyway");

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-anyway");
  });

  it("treats a slow provider as failed once the timeout elapses", async () => {
    const deps = baseDeps();
    deps.getPolicy = vi.fn().mockResolvedValue({ ...FAST_POLICY, retryMaxAttempts: 1, timeoutMs: 30 });
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockImplementation(async (p: FakeProvider) => {
      if (p.id === "a") {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "too-late";
      }
      return "ok-from-b";
    });

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-from-b");
    const failureCall = deps.recordOutcome.mock.calls.find((c) => c[1] === "a");
    expect(failureCall?.[2]).toBe("failure");
  });

  it("computes cost from the successful result's usage and logs it", async () => {
    const deps = baseDeps();
    deps.estimateCost = vi.fn().mockResolvedValue(0.0042);
    const a = provider("a");
    const invoke = vi.fn().mockResolvedValue({ text: "hi", usage: { tokens: 28 } });

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a],
      invoke,
      getUsage: (r: { usage?: { tokens?: number } }) => r.usage,
      ...deps,
    });

    expect(deps.estimateCost).toHaveBeenCalledWith("a", { tokens: 28 });
    expect(deps.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUCCESS", costUsd: 0.0042, providerId: "a" })
    );
    // Phase 12 Module 10 — the SAME computed costUsd is also attached to
    // the returned result, not just logged and discarded, so callers can
    // build a real cost preview from it.
    expect((result as { costUsd?: number }).costUsd).toBe(0.0042);
  });

  it("uses a provider's retryCount override instead of the category policy", async () => {
    const deps = baseDeps();
    deps.getProviderOverrides = vi.fn().mockResolvedValue({ retryCount: 1 });
    const a = provider("a");
    const invoke = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      runGeneration({ category: "LLM", operation: "script", providers: [a], invoke, ...deps })
    ).rejects.toThrow(AllProvidersFailedError);

    // FAST_POLICY.retryMaxAttempts is 2, but the override caps "a" at 1 attempt.
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("uses a provider's timeoutMs override instead of the category policy", async () => {
    const deps = baseDeps();
    deps.getProviderOverrides = vi.fn().mockResolvedValue({ timeoutMs: 30, retryCount: 1 });
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockImplementation(async (p: FakeProvider) => {
      if (p.id === "a") {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return "too-late";
      }
      return "ok-from-b";
    });

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    // FAST_POLICY.timeoutMs is 1000ms (plenty of time for the 200ms delay),
    // but the override caps "a" at 30ms, so it should still time out.
    expect(result).toBe("ok-from-b");
    const failureCall = deps.recordOutcome.mock.calls.find((c) => c[1] === "a");
    expect(failureCall?.[2]).toBe("failure");
  });

  it("skips a provider that has exceeded its admin-set budget/rate limit", async () => {
    const deps = baseDeps();
    deps.checkBudget = vi.fn().mockImplementation(async (_cat: string, id: string) =>
      id === "a" ? { ok: false, reason: "daily budget of $5 reached" } : { ok: true }
    );
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockResolvedValue("ok-from-b");

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-from-b");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(b, expect.anything());
  });

  it("throws AllProvidersFailedError (not a silent fallback) when every provider has exceeded budget", async () => {
    const deps = baseDeps();
    deps.checkBudget = vi.fn().mockResolvedValue({ ok: false, reason: "monthly budget reached" });
    const a = provider("a");
    const invoke = vi.fn();

    await expect(
      runGeneration({ category: "LLM", operation: "script", providers: [a], invoke, ...deps })
    ).rejects.toThrow(AllProvidersFailedError);
    expect(invoke).not.toHaveBeenCalled();
  });

  // Real bug fix (2026-07-25) — a deterministic failure (e.g. gemini_images'
  // content-policy block) used to be retried identically to a transient one,
  // wasting a real attempt and wrongly counting toward the provider's health.
  it("stops retrying a provider immediately on NonRetryableProviderError and excludes it from health tracking", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const b = provider("b");
    const invoke = vi.fn().mockImplementation(async (p: FakeProvider) => {
      if (p.id === "a") throw new NonRetryableProviderError("blocked");
      return "ok-from-b";
    });

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a, b],
      invoke,
      ...deps,
    });

    expect(result).toBe("ok-from-b");
    // Only 1 attempt against "a" (not FAST_POLICY.retryMaxAttempts=2), then 1 against "b".
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(deps.recordOutcome).not.toHaveBeenCalledWith("LLM", "a", "failure", expect.anything());
    expect(deps.logEvent).toHaveBeenCalledWith(expect.objectContaining({ providerId: "a", status: "FAILURE", attempt: 1 }));
  });

  it("throws AllProvidersFailedError after a single attempt when the last provider fails with NonRetryableProviderError", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const invoke = vi.fn().mockRejectedValue(new NonRetryableProviderError("blocked"));

    await expect(
      runGeneration({ category: "LLM", operation: "script", providers: [a], invoke, ...deps })
    ).rejects.toThrow(AllProvidersFailedError);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(deps.recordOutcome).not.toHaveBeenCalled();
  });
});

describe("reorderProvidersByPreference", () => {
  it("moves the preferred provider to the front without dropping any other provider", () => {
    const a = provider("a");
    const b = provider("b");
    const c = provider("c");

    const result = reorderProvidersByPreference([a, b, c], "c");

    expect(result).toEqual([c, a, b]);
  });

  it("returns the original array unchanged when no preference is set", () => {
    const a = provider("a");
    const b = provider("b");
    const providers = [a, b];

    expect(reorderProvidersByPreference(providers)).toBe(providers);
  });

  it("returns the original array unchanged when the preferred provider is already first", () => {
    const a = provider("a");
    const b = provider("b");
    const providers = [a, b];

    expect(reorderProvidersByPreference(providers, "a")).toBe(providers);
  });

  it("returns the original array unchanged when the preferred provider isn't in the chain (e.g. unhealthy/over budget and already filtered out)", () => {
    const a = provider("a");
    const b = provider("b");
    const providers = [a, b];

    expect(reorderProvidersByPreference(providers, "unknown")).toBe(providers);
  });
});

// Real progress feedback (2026-07-25) — a real ~10-minute scene render (2
// failed video-provider attempts + one timed-out retry) used to show
// nothing but a spinner the whole time, indistinguishable from a hang. See
// GenerationProgressEvent's own comment (./types.ts) for the full context.
describe("runGeneration onProgress", () => {
  it("fires attempt_start before each attempt and attempt_failed after each failure, with real attempt/maxAttempts numbers", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const invoke = vi.fn().mockRejectedValue(new Error("down"));
    const events: unknown[] = [];

    await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a],
      invoke,
      onProgress: (e) => {
        events.push(e);
      },
      ...deps,
    }).catch(() => {}); // exhausts and throws AllProvidersFailedError — expected here

    expect(events).toEqual([
      { providerId: "a", attempt: 1, maxAttempts: 2, phase: "attempt_start" },
      { providerId: "a", attempt: 1, maxAttempts: 2, phase: "attempt_failed", error: "down" },
      { providerId: "a", attempt: 2, maxAttempts: 2, phase: "attempt_start" },
      { providerId: "a", attempt: 2, maxAttempts: 2, phase: "attempt_failed", error: "down" },
      { providerId: "a", attempt: 2, maxAttempts: 2, phase: "provider_exhausted", error: "down" },
    ]);
  });

  it("fires no attempt_failed/provider_exhausted events on a first-try success", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const invoke = vi.fn().mockResolvedValue("ok");
    const events: unknown[] = [];

    await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a],
      invoke,
      onProgress: (e) => {
        events.push(e);
      },
      ...deps,
    });

    expect(events).toEqual([{ providerId: "a", attempt: 1, maxAttempts: 2, phase: "attempt_start" }]);
  });

  it("never throws or breaks generation when onProgress itself rejects", async () => {
    const deps = baseDeps();
    const a = provider("a");
    const invoke = vi.fn().mockResolvedValue("ok-despite-bad-callback");

    const result = await runGeneration({
      category: "LLM",
      operation: "script",
      providers: [a],
      invoke,
      onProgress: () => Promise.reject(new Error("progress sink is down")),
      ...deps,
    });

    expect(result).toBe("ok-despite-bad-callback");
  });
});
