import { describe, expect, it } from "vitest";

import { AI_EDIT_QUALITY_RETRY_THRESHOLD, scoreAiTimelinePlan } from "./ai-edit-quality-scoring";
import type { AIBroll, AICaption, AISceneRemoval } from "@/lib/validations/ai-timeline";

// TASK 12 (2026-08-07 — "quality scoring"). Pure heuristics, no vendor
// calls — every test here is deterministic.

const FULL_SCOPE = { captionsInScope: true, visualInScope: true, pacingInScope: true };

function caption(overrides: Partial<AICaption> = {}): AICaption {
  return { text: "hello world", startMs: 0, endMs: 1000, ...overrides };
}

function broll(overrides: Partial<AIBroll> = {}): AIBroll {
  return { startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", resolvedAssetId: "asset-1", ...overrides };
}

describe("scoreAiTimelinePlan", () => {
  it("scores a genuinely thin plan (one short caption, no b-roll, no removals) below the retry threshold", () => {
    const scores = scoreAiTimelinePlan(
      { sceneRemoval: [], captions: [caption({ text: "hi", startMs: 0, endMs: 300 })], zoom: [], broll: [], stickers: [] },
      { sourceDurationMs: 60_000, brollDensity: "HEAVY", ...FULL_SCOPE }
    );
    expect(scores.editingScore).toBeLessThan(AI_EDIT_QUALITY_RETRY_THRESHOLD);
  });

  it("scores a well-covered, well-paced, on-target plan highly", () => {
    const sourceDurationMs = 30_000;
    const captions: AICaption[] = Array.from({ length: 8 }, (_, i) => caption({ text: "short punchy line", startMs: i * 3500, endMs: i * 3500 + 3000, highlightWords: [{ word: "punchy", color: "#FFD60A" }] }));
    const brollItems: AIBroll[] = Array.from({ length: 3 }, (_, i) => broll({ startMs: i * 8000, endMs: i * 8000 + 2000, resolvedAssetId: `asset-${i}` }));
    const sceneRemoval: AISceneRemoval[] = [{ startMs: 1000, endMs: 1500, reason: "silence" }];

    const scores = scoreAiTimelinePlan(
      { sceneRemoval, captions, zoom: [{ startMs: 0, endMs: 1000, scaleFrom: 100, scaleTo: 110, clipId: "x" }], broll: brollItems, stickers: [] },
      { sourceDurationMs, brollDensity: "BALANCED", ...FULL_SCOPE }
    );
    expect(scores.editingScore).toBeGreaterThanOrEqual(AI_EDIT_QUALITY_RETRY_THRESHOLD);
  });

  it("every individual score and the aggregate are within [0,100]", () => {
    const scores = scoreAiTimelinePlan({ sceneRemoval: [], captions: [], zoom: [], broll: [], stickers: [] }, { sourceDurationMs: 10_000, ...FULL_SCOPE });
    for (const value of Object.values(scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  // Real bug found while wiring this into ai-edit-jobs.ts (2026-08-07) —
  // see this function's own doc comment (ai-edit-quality-scoring.ts) for
  // the full incident. These tests are the regression coverage for it.
  describe("module-selection scoping", () => {
    it("does NOT penalize an intentionally-empty visual section when broll/zoom/stickers weren't selected", () => {
      const captions: AICaption[] = Array.from({ length: 5 }, (_, i) => caption({ text: "a reasonably short caption line", startMs: i * 2000, endMs: i * 2000 + 1800 }));
      const scores = scoreAiTimelinePlan(
        { sceneRemoval: [{ startMs: 100, endMs: 200, reason: "silence" }], captions, zoom: [], broll: [], stickers: [] },
        { sourceDurationMs: 10_000, captionsInScope: true, visualInScope: false, pacingInScope: true }
      );
      // visualScore itself is still computed (and would be low — nothing
      // was proposed), but must NOT drag the aggregate down since it's
      // out of scope for this run.
      expect(scores.visualScore).toBeLessThan(50);
      expect(scores.editingScore).toBeGreaterThanOrEqual(AI_EDIT_QUALITY_RETRY_THRESHOLD);
    });

    it("does NOT penalize an intentionally-empty caption section when captions weren't selected", () => {
      const brollItems: AIBroll[] = Array.from({ length: 3 }, (_, i) => broll({ startMs: i * 3000, endMs: i * 3000 + 2000 }));
      const scores = scoreAiTimelinePlan(
        { sceneRemoval: [], captions: [], zoom: [], broll: brollItems, stickers: [] },
        { sourceDurationMs: 10_000, brollDensity: "HEAVY", captionsInScope: false, visualInScope: true, pacingInScope: false }
      );
      expect(scores.captionScore).toBe(0);
      // Only visualScore is in scope here — a real b-roll-only run with a
      // reasonable count for a 10s HEAVY video should score fine.
      expect(scores.editingScore).toBe(scores.visualScore);
    });

    it("defaults to a neutral 100 (never a misleading 0) when no dimension is in scope at all", () => {
      const scores = scoreAiTimelinePlan(
        { sceneRemoval: [], captions: [], zoom: [], broll: [], stickers: [] },
        { sourceDurationMs: 10_000, captionsInScope: false, visualInScope: false, pacingInScope: false }
      );
      expect(scores.editingScore).toBe(100);
    });
  });

  describe("visual score vs. b-roll density target (computeBrollTargetRange)", () => {
    it("scores a HEAVY-density plan with only ONE resolved b-roll clip for a full minute LOW — the exact founder-reported bug", () => {
      const scores = scoreAiTimelinePlan(
        { sceneRemoval: [], captions: [caption({ startMs: 0, endMs: 55_000 })], zoom: [], broll: [broll()], stickers: [] },
        { sourceDurationMs: 60_000, brollDensity: "HEAVY", ...FULL_SCOPE }
      );
      // Target for 60s HEAVY is 6-12; one clip is far below it.
      expect(scores.visualScore).toBeLessThan(40);
    });

    it("scores a HEAVY-density plan with a real 6-12/min spread of resolved clips highly", () => {
      const brollItems = Array.from({ length: 8 }, (_, i) => broll({ startMs: i * 7000, endMs: i * 7000 + 2000, resolvedAssetId: `asset-${i}` }));
      const scores = scoreAiTimelinePlan(
        { sceneRemoval: [], captions: [caption({ startMs: 0, endMs: 55_000 })], zoom: [], broll: brollItems, stickers: [] },
        { sourceDurationMs: 60_000, brollDensity: "HEAVY", ...FULL_SCOPE }
      );
      expect(scores.visualScore).toBeGreaterThanOrEqual(80);
    });
  });
});
