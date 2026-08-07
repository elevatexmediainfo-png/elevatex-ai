import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const planStoryMock = vi.fn();
const planDirectorCaptionsMock = vi.fn();
const planVisualsMock = vi.fn();
const planAudioMock = vi.fn();
const reviewQualityMock = vi.fn();
vi.mock("@/lib/generation/reasoning", () => ({
  planStory: (...args: unknown[]) => planStoryMock(...args),
  planDirectorCaptions: (...args: unknown[]) => planDirectorCaptionsMock(...args),
  planVisuals: (...args: unknown[]) => planVisualsMock(...args),
  planAudio: (...args: unknown[]) => planAudioMock(...args),
  reviewQuality: (...args: unknown[]) => reviewQualityMock(...args),
}));

const getConfigMock = vi.fn();
vi.mock("@/lib/admin/config", () => ({ getConfig: (...args: unknown[]) => getConfigMock(...args) }));

vi.mock("@/app/editor/[projectId]/ai-timeline-translator", () => ({
  normalizeSceneRemovalWindows: (w: unknown) => w,
}));

import { runDirectorPipeline } from "./orchestrator";
import type { DirectorJobMeta, SpeechAnalysisOutput } from "./types";

const CONFIG_DEFAULTS: Record<string, unknown> = {
  AI_EDIT_QUALITY_TARGET_SCORE: 90,
  AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS: 3,
  AI_EDIT_NO_DEAD_SCREEN_GAP_THRESHOLD_MS: 2000,
  AI_EDIT_QUALITY_CATEGORY_WEIGHTS: {},
  AI_EDIT_SFX_MAX_PER_10S: 1,
};

function baseSpeech(): SpeechAnalysisOutput {
  return {
    words: [{ word: "hi", startMs: 0, endMs: 500 }],
    sceneRemoval: [],
    survivingSegmentCount: 1,
    sourceDurationMs: 20_000,
  };
}

function baseJobMeta(): DirectorJobMeta {
  return { userId: "user_1", repairMaxAttempts: 1 };
}

function wantsAll() {
  return () => true;
}

const STORY_RESULT = {
  beats: [{ kind: "value", startMs: 0, endMs: 20_000, description: "x" }],
  hookText: "hook",
  retentionScore: 70,
  retentionRisks: [],
  costUsd: 0.01,
};
const CAPTIONS_RESULT = { captions: [{ text: "hi there", startMs: 0, endMs: 20_000 }], costUsd: 0.01 };
// 4 items (not 1) — computeBrollTargetRange's short-form floor
// (2026-08-07 quality-calibration pass, gpt5.provider.ts) now targets
// 4-7 b-roll slots for a 20s video at the default density, up from the
// old unfloored 1-2; keeping this fixture at just 1 item would score
// deterministic broll as "weak" and trigger an unwanted extra retry
// round in the "no retry needed" tests below, which aren't testing
// broll-density calibration at all — just the orchestration control flow.
const VISUALS_RESULT = {
  zoom: [],
  broll: [
    { startMs: 0, endMs: 4000, trackHint: "broll", source: "stock", searchQuery: "x" },
    { startMs: 5000, endMs: 8000, trackHint: "broll", source: "stock", searchQuery: "x" },
    { startMs: 10000, endMs: 13000, trackHint: "broll", source: "stock", searchQuery: "x" },
    { startMs: 15000, endMs: 18000, trackHint: "broll", source: "stock", searchQuery: "x" },
  ],
  stickers: [],
  transitions: [],
  costUsd: 0.01,
};
const AUDIO_RESULT = { sfx: [], costUsd: 0.01 };

function reviewResult(overallLikeScores: Partial<{ hookScore: number; retentionScore: number; storyScore: number; weakCategories: string[] }>) {
  return {
    hookScore: 90,
    retentionScore: 90,
    storyScore: 90,
    weakCategories: [],
    costUsd: 0.01,
    ...overallLikeScores,
  };
}

beforeEach(() => {
  getConfigMock.mockImplementation((key: string) => Promise.resolve(CONFIG_DEFAULTS[key]));
  planStoryMock.mockResolvedValue(STORY_RESULT);
  planDirectorCaptionsMock.mockResolvedValue(CAPTIONS_RESULT);
  planVisualsMock.mockResolvedValue(VISUALS_RESULT);
  planAudioMock.mockResolvedValue(AUDIO_RESULT);
  reviewQualityMock.mockResolvedValue(reviewResult({}));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runDirectorPipeline", () => {
  it("runs story -> captions -> visuals -> audio in order and finalizes on the first pass when the score clears the target", async () => {
    const result = await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() });

    expect(planStoryMock).toHaveBeenCalledTimes(1);
    expect(planDirectorCaptionsMock).toHaveBeenCalledTimes(1);
    expect(planVisualsMock).toHaveBeenCalledTimes(1);
    expect(planAudioMock).toHaveBeenCalledTimes(1);
    expect(reviewQualityMock).toHaveBeenCalledTimes(1); // no retry needed
    expect(result.scores.thresholdMet).toBe(true);
    expect(result.scores.iterations).toBe(1);
    expect(result.captions).toEqual(CAPTIONS_RESULT.captions);
    expect(result.story.hookText).toBe("hook");
    expect(result.reasoningCostUsd).toBeCloseTo(0.05); // story+captions+visuals+audio+review
  });

  it("skips an agent entirely when none of its owned modules are selected, but Story still runs", async () => {
    const wantsOnlyMusic = (m: string) => m === "music";
    await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsOnlyMusic });

    expect(planStoryMock).toHaveBeenCalledTimes(1); // always runs — shared context
    expect(planDirectorCaptionsMock).not.toHaveBeenCalled();
    expect(planVisualsMock).not.toHaveBeenCalled();
    expect(planAudioMock).toHaveBeenCalledTimes(1);
  });

  it("retries ONLY the agent(s) owning the weak category, not the whole edit", async () => {
    // A half-formed music proposal (no searchQuery/assetId) scores
    // musicScore deterministically low, which alone drags overallScore
    // below the target — genuinely exercising the "only audio reruns"
    // path without needing to fight the judged categories' own coupling
    // to "story" (every one of hook/emotion/retention/storyFlow maps at
    // least partly to "story" in CATEGORY_AGENT_MAP).
    planAudioMock.mockResolvedValueOnce({ music: { duckingEnabled: true }, sfx: [], costUsd: 0.01 }).mockResolvedValueOnce(AUDIO_RESULT);

    const result = await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() });

    expect(planStoryMock).toHaveBeenCalledTimes(1); // never re-run — "music" only invalidates "audio"
    expect(planDirectorCaptionsMock).toHaveBeenCalledTimes(1);
    expect(planVisualsMock).toHaveBeenCalledTimes(1);
    expect(planAudioMock).toHaveBeenCalledTimes(2); // re-run once
    expect(reviewQualityMock).toHaveBeenCalledTimes(2);
    expect(result.scores.iterations).toBe(2);
    expect(result.scores.thresholdMet).toBe(true);
  });

  it("cascades downstream — a weak 'hook' (story) reruns story AND everything downstream of it", async () => {
    reviewQualityMock.mockResolvedValueOnce(reviewResult({ hookScore: 20, weakCategories: ["hook"] })).mockResolvedValueOnce(reviewResult({}));

    await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() });

    expect(planStoryMock).toHaveBeenCalledTimes(2);
    expect(planDirectorCaptionsMock).toHaveBeenCalledTimes(2);
    expect(planVisualsMock).toHaveBeenCalledTimes(2);
    expect(planAudioMock).toHaveBeenCalledTimes(2);
  });

  it("stops at maxIterations and finalizes with the BEST-scoring attempt, honestly stamping thresholdMet:false", async () => {
    getConfigMock.mockImplementation((key: string) => Promise.resolve(key === "AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS" ? 2 : CONFIG_DEFAULTS[key]));
    reviewQualityMock
      .mockResolvedValueOnce(reviewResult({ hookScore: 40, weakCategories: ["hook"] })) // iteration 1: weak, score below target
      .mockResolvedValueOnce(reviewResult({ hookScore: 50, weakCategories: ["hook"] })); // iteration 2: still weak, still below target — maxIterations(2) reached

    const result = await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() });

    expect(result.scores.thresholdMet).toBe(false); // never silently claims success
    expect(result.scores.iterations).toBe(2);
    // The best (higher-scoring, iteration 2) attempt was kept.
    expect(reviewQualityMock).toHaveBeenCalledTimes(2);
  });

  it("stops early on stagnation (2 consecutive non-improving rounds) rather than burning the full iteration budget", async () => {
    getConfigMock.mockImplementation((key: string) => Promise.resolve(key === "AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS" ? 6 : CONFIG_DEFAULTS[key]));
    reviewQualityMock
      .mockResolvedValueOnce(reviewResult({ hookScore: 40, weakCategories: ["hook"] })) // iter 1
      .mockResolvedValueOnce(reviewResult({ hookScore: 40, weakCategories: ["hook"] })) // iter 2 — no improvement (1st non-improving)
      .mockResolvedValueOnce(reviewResult({ hookScore: 40, weakCategories: ["hook"] })); // iter 3 — no improvement (2nd non-improving) -> stop, even though maxIterations=6

    const result = await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() });

    expect(reviewQualityMock).toHaveBeenCalledTimes(3); // stopped well before the 6-iteration cap
    expect(result.scores.iterations).toBe(3);
  });

  it("a failed retry iteration is non-fatal — keeps the best attempt already seen", async () => {
    reviewQualityMock
      .mockResolvedValueOnce(reviewResult({ hookScore: 40, weakCategories: ["hook"] })) // iteration 1
      .mockRejectedValueOnce(new Error("network blip")); // iteration 2's own review call fails

    const result = await runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() });

    // The pipeline itself never throws — the first (already-valid) attempt is kept.
    expect(result.captions).toEqual(CAPTIONS_RESULT.captions);
    expect(result.scores.iterations).toBe(1);
  });

  it("propagates a failure on the very first pass (nothing valid to fall back to yet)", async () => {
    planStoryMock.mockRejectedValueOnce(new Error("gpt5 down"));
    await expect(runDirectorPipeline({ videoAnalysis: null, speech: baseSpeech(), jobMeta: baseJobMeta(), wantsModule: wantsAll() })).rejects.toThrow(/gpt5 down/);
  });
});
