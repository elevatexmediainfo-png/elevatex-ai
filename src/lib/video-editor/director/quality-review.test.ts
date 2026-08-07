import { describe, expect, it } from "vitest";
import { createEmptyVarietyLedger } from "./variety-ledger";
import {
  buildQualityScoresV2,
  computeDeterministicScores,
  computeOverallScore,
  countTrailingNonImproving,
  resolveAgentsToRerun,
  scoreBrollDeterministic,
  scoreMusicDeterministic,
  scoreSfxDeterministic,
  scoreZoomDeterministic,
} from "./quality-review";
import type { DirectorIterationEntry } from "./types";
import type { AiQualityScoresV2 } from "@/lib/validations/ai-timeline";

function broll(startMs: number, endMs: number) {
  return { startMs, endMs, trackHint: "broll", source: "stock" as const, searchQuery: "x" };
}

describe("scoreBrollDeterministic", () => {
  // The exact bug this deliberately avoids — see ai-edit-quality-scoring.ts's
  // own flagged comment: counting resolvedAssetId here would always be 0
  // (scoring runs before asset resolution), so this counts PROPOSED items.
  it("scores by proposed COUNT, not resolvedAssetId — a full target range with none resolved yet still scores well", () => {
    const items = Array.from({ length: 4 }, (_, i) => broll(i * 1000, i * 1000 + 500)); // no resolvedAssetId on any
    // 60s BALANCED target is 3-6 -> 4 is in range.
    expect(scoreBrollDeterministic(items, 60_000, "BALANCED")).toBe(100);
  });

  it("degrades below the target range and above it", () => {
    expect(scoreBrollDeterministic([broll(0, 500)], 60_000, "HEAVY")).toBeLessThan(50); // way under the 6-12 target
    const tooMany = Array.from({ length: 20 }, (_, i) => broll(i * 1000, i * 1000 + 500));
    expect(scoreBrollDeterministic(tooMany, 60_000, "MINIMAL")).toBeLessThan(100); // way over the 1-3 target
  });
});

describe("scoreMusicDeterministic", () => {
  it("scores 100 when music is absent (a valid editorial choice)", () => {
    expect(scoreMusicDeterministic(undefined)).toBe(100);
  });
  it("scores 100 when present with a real query", () => {
    expect(scoreMusicDeterministic({ searchQuery: "calm piano", duckingEnabled: true })).toBe(100);
  });
  it("scores lower when present but half-formed (no query or asset)", () => {
    expect(scoreMusicDeterministic({ duckingEnabled: true } as never)).toBeLessThan(100);
  });
});

describe("scoreSfxDeterministic", () => {
  it("scores 100 with zero sfx (a valid choice)", () => {
    expect(scoreSfxDeterministic([], 1)).toBe(100);
  });
  it("scores 100 for a sane, non-spammy spread", () => {
    const sfx = [{ assetQuery: "whoosh", atMs: 0 }, { assetQuery: "pop", atMs: 15_000 }];
    expect(scoreSfxDeterministic(sfx, 1)).toBe(100);
  });
  it("penalizes spam — several events crammed into one 10s window", () => {
    const sfx = [{ assetQuery: "a", atMs: 0 }, { assetQuery: "b", atMs: 1000 }, { assetQuery: "c", atMs: 2000 }, { assetQuery: "d", atMs: 3000 }];
    expect(scoreSfxDeterministic(sfx, 1)).toBeLessThan(100);
  });
});

describe("scoreZoomDeterministic", () => {
  it("scores 100 with zero zoom (a valid choice for calm content)", () => {
    expect(scoreZoomDeterministic([], 60_000)).toBe(100);
  });

  it("scores 100 for a reasonable count with fully diverse named styles", () => {
    const zoom = [
      { startMs: 0, endMs: 500, scaleFrom: 100, scaleTo: 110, style: "fast_punch" as const },
      { startMs: 1000, endMs: 1500, scaleFrom: 100, scaleTo: 115, style: "slow_push" as const },
    ];
    expect(scoreZoomDeterministic(zoom, 60_000)).toBe(100);
  });

  it("penalizes every zoom using the identical named style (monotonous, regardless of count)", () => {
    const zoom = Array.from({ length: 3 }, (_, i) => ({ startMs: i * 1000, endMs: i * 1000 + 400, scaleFrom: 100, scaleTo: 110, style: "fast_punch" as const }));
    expect(scoreZoomDeterministic(zoom, 60_000)).toBeLessThan(100);
  });

  it("penalizes a genuinely excessive count well beyond what the video length could plausibly support", () => {
    const zoom = Array.from({ length: 30 }, (_, i) => ({ startMs: i * 500, endMs: i * 500 + 200, scaleFrom: 100, scaleTo: 110 }));
    expect(scoreZoomDeterministic(zoom, 30_000)).toBeLessThan(100); // 30 zooms in a 30s video
  });
});

describe("computeDeterministicScores", () => {
  it("treats an empty caption section as neutral (100), not a defect, when captions weren't proposed at all", () => {
    const scores = computeDeterministicScores({
      captions: [],
      broll: [],
      zoom: [],
      sceneRemoval: [],
      sfx: [],
      varietyLedger: createEmptyVarietyLedger(),
      sourceDurationMs: 10_000,
      sfxMaxPer10s: 1,
    });
    expect(scores.captionScore).toBe(100);
    expect(scores.editingRhythmScore).toBe(100);
  });
});

describe("computeOverallScore", () => {
  it("weights categories per the given weight map", () => {
    const perCategory = {
      hook: 100, retention: 100, captions: 0, broll: 100, music: 100, sfx: 100, zoom: 100, story: 100, visualVariety: 100, editingRhythm: 100,
    };
    // Weighting captions at 0 excludes its 0-score from dragging the average down.
    const withoutCaptionsWeight = computeOverallScore(perCategory, { captions: 0 });
    expect(withoutCaptionsWeight).toBe(100);
    const withDefaultWeights = computeOverallScore(perCategory, {});
    expect(withDefaultWeights).toBeLessThan(100); // captions' 0 now drags the equal-weighted average down
  });
});

describe("buildQualityScoresV2", () => {
  it("unions deterministic-weak categories with the reviewer's own self-reported weakCategories", () => {
    const deterministic = { captionScore: 30, brollScore: 100, musicScore: 100, sfxScore: 100, zoomScore: 100, visualVarietyScore: 100, editingRhythmScore: 100 }; // captions below the deterministic weak threshold
    const judged = { hookScore: 90, retentionScore: 90, storyScore: 90, weakCategories: ["music" as const] };
    const result = buildQualityScoresV2(deterministic, judged, {}, 90, 1);
    expect(result.weakCategoriesFinal).toEqual(expect.arrayContaining(["captions", "music"]));
    expect(result.thresholdMet).toBe(result.overallScore >= 90);
  });
});

describe("resolveAgentsToRerun", () => {
  it("maps a weak category to its owning agent", () => {
    expect(resolveAgentsToRerun(["music"])).toEqual(["audio"]);
  });

  it("cascades downstream — a weak 'hook' (story) also invalidates captions/visuals/audio", () => {
    const agents = resolveAgentsToRerun(["hook"]);
    expect(agents).toEqual(expect.arrayContaining(["story", "captions", "visuals", "audio"]));
  });

  it("does NOT rerun story/captions when only a visuals-owned category is weak", () => {
    const agents = resolveAgentsToRerun(["broll"]);
    expect(agents).toEqual(expect.arrayContaining(["visuals", "audio"]));
    expect(agents).not.toContain("story");
    expect(agents).not.toContain("captions");
  });
});

describe("countTrailingNonImproving", () => {
  function entry(overallScore: number): DirectorIterationEntry {
    return { iteration: 0, agentsInvoked: [], scores: { overallScore } as AiQualityScoresV2, timestamp: "" };
  }

  it("counts consecutive trailing rounds that didn't improve on the one before", () => {
    const history = [entry(50), entry(60), entry(58), entry(58)]; // improved, then flat, then flat again
    expect(countTrailingNonImproving(history)).toBe(2);
  });

  it("resets to 0 right after an improving round", () => {
    const history = [entry(50), entry(40), entry(70)];
    expect(countTrailingNonImproving(history)).toBe(0);
  });
});
