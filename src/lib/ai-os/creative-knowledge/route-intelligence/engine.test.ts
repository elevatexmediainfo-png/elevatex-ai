import { describe, expect, it } from "vitest";

import { evaluateIntelligence } from "./engine";
import type { RouteEvaluationContext } from "./types";

// ── Shared context fixtures ───────────────────────────────────────────────────

function restaurantContext(): RouteEvaluationContext {
  return {
    industry: "restaurant",
    campaign: { goal: "awareness" },
    rawIdea:  "Grand opening promo for a new restaurant",
  };
}

function dentalContext(): RouteEvaluationContext {
  return {
    industry: "dental",
    campaign: { goal: "conversion" },
    rawIdea:  "Dental implant offer for new patients",
  };
}

// ── Mode field correctness ────────────────────────────────────────────────────

describe("evaluateIntelligence — mode field", () => {
  it("modeResult.mode === 'deterministic' when no mode is passed", () => {
    const result = evaluateIntelligence(restaurantContext());
    expect(result.modeResult?.mode).toBe("deterministic");
  });

  it("modeResult.mode === 'deterministic' when mode: 'deterministic' is explicit", () => {
    const result = evaluateIntelligence(restaurantContext(), { mode: "deterministic" });
    expect(result.modeResult?.mode).toBe("deterministic");
  });

  it("modeResult.mode === 'exploration' when mode: 'exploration' is passed", () => {
    const result = evaluateIntelligence(restaurantContext(), { mode: "exploration" });
    expect(result.modeResult?.mode).toBe("exploration");
  });
});

// ── Deterministic stability ───────────────────────────────────────────────────

describe("evaluateIntelligence — deterministic stability", () => {
  it("returns the same route on every call for the same context", () => {
    const ctx = restaurantContext();
    const a = evaluateIntelligence(ctx, { mode: "deterministic" });
    const b = evaluateIntelligence(ctx, { mode: "deterministic" });
    expect(a.selected.route.id).toBe(b.selected.route.id);
  });

  it("always selects the top-ranked candidate", () => {
    const result = evaluateIntelligence(restaurantContext(), {
      mode: "deterministic",
      includeFullRanking: true,
    });
    expect(result.selected.route.id).toBe(result.rankedCandidates[0]?.route.id);
  });
});

// ── Exploration metadata ──────────────────────────────────────────────────────

describe("evaluateIntelligence — exploration metadata", () => {
  it("populates exploration metadata on modeResult", () => {
    const result = evaluateIntelligence(restaurantContext(), { mode: "exploration" });
    expect(result.modeResult).toBeDefined();
    expect(result.modeResult?.mode).toBe("exploration");
    const exploration = result.modeResult?.mode === "exploration"
      ? result.modeResult.exploration
      : undefined;
    expect(exploration).toBeDefined();
    expect(typeof exploration?.candidatesEvaluated).toBe("number");
    expect(exploration?.candidatesEvaluated ?? 0).toBeGreaterThan(0);
  });

  it("selected candidate is always defined in exploration mode", () => {
    const result = evaluateIntelligence(restaurantContext(), { mode: "exploration" });
    expect(result.selected).toBeDefined();
    expect(result.selected.route.id).toBeTruthy();
  });
});

// ── Result shape ──────────────────────────────────────────────────────────────

describe("evaluateIntelligence — result shape", () => {
  it("returns a valid RouteIntelligenceResult for restaurant + awareness", () => {
    const result = evaluateIntelligence(restaurantContext());
    expect(result.selected).toBeDefined();
    expect(result.resultQuality).toMatch(/^(high|medium|low)$/);
    expect(result.evaluatedAt).toBeTruthy();
    expect(result.generatedCount).toBeGreaterThan(0);
  });

  it("returns a valid result for dental + conversion", () => {
    const result = evaluateIntelligence(dentalContext());
    expect(result.selected).toBeDefined();
    expect(result.selected.route.id).toBeTruthy();
  });

  it("includeFullRanking: false returns empty rankedCandidates array", () => {
    const result = evaluateIntelligence(restaurantContext(), { includeFullRanking: false });
    expect(result.rankedCandidates).toHaveLength(0);
  });

  it("includeFullRanking: true returns a non-empty rankedCandidates array", () => {
    const result = evaluateIntelligence(restaurantContext(), { includeFullRanking: true });
    expect(result.rankedCandidates.length).toBeGreaterThan(0);
  });
});

// ── IntentSignature / ExecutionSignature ──────────────────────────────────────

describe("evaluateIntelligence — signatures", () => {
  it("modeResult.intentSignature is populated", () => {
    const result = evaluateIntelligence(restaurantContext());
    expect(result.modeResult).toBeDefined();
    expect(typeof result.modeResult?.intentSignature.hash).toBe("string");
  });

  it("modeResult.executionSignature is populated", () => {
    const result = evaluateIntelligence(restaurantContext());
    expect(result.modeResult).toBeDefined();
    expect(typeof result.modeResult?.executionSignature.hash).toBe("string");
  });

  it("same context produces the same intentSignature in both modes", () => {
    const ctx = restaurantContext();
    const det = evaluateIntelligence(ctx, { mode: "deterministic" });
    const exp = evaluateIntelligence(ctx, { mode: "exploration" });
    // Intent (industry + goal) is mode-independent — only execution differs
    expect(det.modeResult?.intentSignature.hash).toBe(exp.modeResult?.intentSignature.hash);
  });
});
