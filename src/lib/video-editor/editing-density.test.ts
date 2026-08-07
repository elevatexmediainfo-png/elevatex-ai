import { describe, expect, it } from "vitest";
import {
  computeActualDensities,
  computeAdaptiveDensityTargets,
  computeFootageCharacteristics,
  computeSpeechCharacteristics,
  describeDensityGuidanceForPrompt,
  scoreDensityAlignment,
  type VideoUnderstandingSummary,
} from "./editing-density";

// Builds a synthetic transcript of `count` words spoken evenly across
// `totalMs`, cycling through `vocab` — lets tests dial speaking rate and
// vocabulary richness independently and precisely.
function words(count: number, totalMs: number, vocab: string[] = ["word"]) {
  const stepMs = totalMs / count;
  return Array.from({ length: count }, (_, i) => ({
    word: vocab[i % vocab.length],
    startMs: Math.round(i * stepMs),
    endMs: Math.round(i * stepMs + stepMs * 0.8),
  }));
}

const RICH_VOCAB = Array.from({ length: 200 }, (_, i) => `unique${i}`);
// Deliberately mid-range (~50% unique/total at 130 words) — lands strictly
// between the "high vocabulary richness" (>=0.65) and "repetitive/filler-
// heavy" (<=0.4) thresholds, so it fires neither adjustment note.
const MID_VOCAB = Array.from({ length: 65 }, (_, i) => `word${i}`);

describe("computeSpeechCharacteristics", () => {
  it("returns a neutral zero-signal result for no words", () => {
    expect(computeSpeechCharacteristics([])).toEqual({ speakingRateWpm: 0, vocabularyRichness: 0, paceBucket: "NORMAL" });
  });

  it("buckets a fast speaker as FAST", () => {
    // 200 words spoken over exactly 1 minute -> 200 wpm, above the 165 FAST cutoff.
    const result = computeSpeechCharacteristics(words(200, 60_000));
    expect(result.paceBucket).toBe("FAST");
    expect(result.speakingRateWpm).toBeCloseTo(200, 0);
  });

  it("buckets a slow speaker as SLOW", () => {
    // 80 words over 1 minute -> 80 wpm, below the 105 SLOW cutoff.
    const result = computeSpeechCharacteristics(words(80, 60_000));
    expect(result.paceBucket).toBe("SLOW");
  });

  it("buckets a mid-range speaker as NORMAL", () => {
    const result = computeSpeechCharacteristics(words(130, 60_000));
    expect(result.paceBucket).toBe("NORMAL");
  });

  it("measures high vocabulary richness for all-distinct words", () => {
    const result = computeSpeechCharacteristics(words(100, 60_000, RICH_VOCAB));
    expect(result.vocabularyRichness).toBeCloseTo(1, 5);
  });

  it("measures low vocabulary richness for heavily repeated words", () => {
    const result = computeSpeechCharacteristics(words(100, 60_000, ["the", "um"]));
    expect(result.vocabularyRichness).toBeCloseTo(0.02, 2);
  });

  it("strips surrounding punctuation before dedup so 'word.' and 'word' count as one", () => {
    const raw = [
      { word: "Hello,", startMs: 0, endMs: 200 },
      { word: "hello", startMs: 200, endMs: 400 },
      { word: "world!", startMs: 400, endMs: 600 },
    ];
    const result = computeSpeechCharacteristics(raw);
    // "Hello," and "hello" normalize to the same token -> 2 unique of 3 total.
    expect(result.vocabularyRichness).toBeCloseTo(2 / 3, 5);
  });
});

function footage(overrides: Partial<VideoUnderstandingSummary> = {}): VideoUnderstandingSummary {
  return { emphasisMoments: [], emotionBeats: [], visualContext: [], gestures: [], ...overrides };
}

describe("computeFootageCharacteristics", () => {
  it("reports no analysis when videoAnalysis is null", () => {
    expect(computeFootageCharacteristics(null, 60_000)).toEqual({
      existingVisualVarietyPerMin: 0,
      emotionalIntensityPerMin: 0,
      hasFootageAnalysis: false,
    });
  });

  it("reports zero variety for a visually static minute of footage", () => {
    const result = computeFootageCharacteristics(footage(), 60_000);
    expect(result.hasFootageAnalysis).toBe(true);
    expect(result.existingVisualVarietyPerMin).toBe(0);
  });

  it("measures real visual variety from visualContext + gestures combined", () => {
    const va = footage({
      visualContext: Array.from({ length: 6 }, (_, i) => ({ startMs: i * 1000, endMs: i * 1000 + 500 })),
      gestures: Array.from({ length: 4 }, (_, i) => ({ startMs: i * 1000, endMs: i * 1000 + 500 })),
    });
    // 10 events over 1 minute -> 10/min.
    expect(computeFootageCharacteristics(va, 60_000).existingVisualVarietyPerMin).toBeCloseTo(10, 5);
  });

  it("measures emotional intensity from emotionBeats count", () => {
    const va = footage({ emotionBeats: [{ startMs: 0, endMs: 500, emotion: "excited" }, { startMs: 1000, endMs: 1500, emotion: "serious" }] });
    expect(computeFootageCharacteristics(va, 60_000).emotionalIntensityPerMin).toBeCloseTo(2, 5);
  });
});

describe("computeAdaptiveDensityTargets — same preset, different real output", () => {
  const flatFootage = { existingVisualVarietyPerMin: 3, emotionalIntensityPerMin: 1, hasFootageAnalysis: true };

  it("gives a slow speaker MORE visual support than a fast speaker at the SAME HEAVY preset", () => {
    const slow = computeSpeechCharacteristics(words(80, 60_000, RICH_VOCAB));
    const fast = computeSpeechCharacteristics(words(200, 60_000, RICH_VOCAB));

    const slowTargets = computeAdaptiveDensityTargets(slow, flatFootage, "HEAVY");
    const fastTargets = computeAdaptiveDensityTargets(fast, flatFootage, "HEAVY");

    expect(slowTargets.adapted.visualPerMin.max).toBeGreaterThan(fastTargets.adapted.visualPerMin.max);
    expect(slowTargets.adjustmentNotes.some((n) => n.includes("Slow speaker"))).toBe(true);
    expect(fastTargets.adjustmentNotes.some((n) => n.includes("Fast speaker"))).toBe(true);
  });

  it("gives visually static footage MORE added visual support than already-varied footage, same preset", () => {
    const normalSpeech = computeSpeechCharacteristics(words(130, 60_000, RICH_VOCAB));
    const staticFootage = { existingVisualVarietyPerMin: 0.5, emotionalIntensityPerMin: 1, hasFootageAnalysis: true };
    const variedFootage = { existingVisualVarietyPerMin: 8, emotionalIntensityPerMin: 1, hasFootageAnalysis: true };

    const staticTargets = computeAdaptiveDensityTargets(normalSpeech, staticFootage, "BALANCED");
    const variedTargets = computeAdaptiveDensityTargets(normalSpeech, variedFootage, "BALANCED");

    expect(staticTargets.adapted.visualPerMin.max).toBeGreaterThan(variedTargets.adapted.visualPerMin.max);
  });

  it("gives high emotional intensity more motion but less audio (SFX) than low intensity", () => {
    const normalSpeech = computeSpeechCharacteristics(words(130, 60_000, RICH_VOCAB));
    const highEmotion = { existingVisualVarietyPerMin: 3, emotionalIntensityPerMin: 5, hasFootageAnalysis: true };
    const lowEmotion = { existingVisualVarietyPerMin: 3, emotionalIntensityPerMin: 0.5, hasFootageAnalysis: true };

    const highTargets = computeAdaptiveDensityTargets(normalSpeech, highEmotion, "BALANCED");
    const lowTargets = computeAdaptiveDensityTargets(normalSpeech, lowEmotion, "BALANCED");

    expect(highTargets.adapted.motionPerMin.max).toBeGreaterThan(lowTargets.adapted.motionPerMin.max);
    expect(highTargets.adapted.audioPerMin.max).toBeLessThan(lowTargets.adapted.audioPerMin.max);
  });

  it("gives high vocabulary richness more visual support than repetitive/filler-heavy delivery", () => {
    const richSpeech = computeSpeechCharacteristics(words(130, 60_000, RICH_VOCAB));
    const fillerSpeech = computeSpeechCharacteristics(words(130, 60_000, ["um", "like"]));

    const richTargets = computeAdaptiveDensityTargets(richSpeech, flatFootage, "BALANCED");
    const fillerTargets = computeAdaptiveDensityTargets(fillerSpeech, flatFootage, "BALANCED");

    expect(richTargets.adapted.visualPerMin.max).toBeGreaterThan(fillerTargets.adapted.visualPerMin.max);
  });

  it("clamps combined worst-case adjustments to +/-30% of the preset baseline", () => {
    // Stack every "increase" signal at once: slow speaker + static footage +
    // high emotion + rich vocabulary — all pushing visualMotionMultiplier up.
    const slowRichSpeech = computeSpeechCharacteristics(words(80, 60_000, RICH_VOCAB));
    const extremeFootage = { existingVisualVarietyPerMin: 0, emotionalIntensityPerMin: 10, hasFootageAnalysis: true };
    const targets = computeAdaptiveDensityTargets(slowRichSpeech, extremeFootage, "BALANCED");

    // Baseline BALANCED visualPerMin.max is 16 — the combined multiplier is
    // clamped to at most 1.3x, so the adapted max can never exceed 16*1.3.
    expect(targets.adapted.visualPerMin.max).toBeLessThanOrEqual(16 * 1.3 + 1e-6);

    // Stack every "decrease" signal at once for motion: fast speaker + varied
    // footage — clamped to at most a 0.7x floor on the visual/motion side.
    const fastFillerSpeech = computeSpeechCharacteristics(words(200, 60_000, ["um", "like"]));
    const busyFootage = { existingVisualVarietyPerMin: 20, emotionalIntensityPerMin: 0, hasFootageAnalysis: true };
    const lowTargets = computeAdaptiveDensityTargets(fastFillerSpeech, busyFootage, "BALANCED");
    expect(lowTargets.adapted.visualPerMin.max).toBeGreaterThanOrEqual(16 * 0.7 - 1e-6);
  });

  it("never scales retention coverage ratio by preset — even MINIMAL must not read as mostly dead air", () => {
    const speech = computeSpeechCharacteristics(words(130, 60_000, RICH_VOCAB));
    const minimalTargets = computeAdaptiveDensityTargets(speech, flatFootage, "MINIMAL");
    const heavyTargets = computeAdaptiveDensityTargets(speech, flatFootage, "HEAVY");
    expect(minimalTargets.adapted.retentionCoverageRatio).toEqual(heavyTargets.adapted.retentionCoverageRatio);
  });

  it("does not adapt caption chunk size by speech/footage signals — it's a style choice, not a rhythm one", () => {
    const slow = computeSpeechCharacteristics(words(80, 60_000, RICH_VOCAB));
    const fast = computeSpeechCharacteristics(words(200, 60_000, RICH_VOCAB));
    const slowTargets = computeAdaptiveDensityTargets(slow, flatFootage, "BALANCED");
    const fastTargets = computeAdaptiveDensityTargets(fast, flatFootage, "BALANCED");
    expect(slowTargets.adapted.captionAvgWords).toEqual(fastTargets.adapted.captionAvgWords);
  });
});

describe("describeDensityGuidanceForPrompt", () => {
  it("produces natural-language guidance including the why-these-numbers explanation when adjustments were made", () => {
    const speech = computeSpeechCharacteristics(words(80, 60_000, RICH_VOCAB));
    const targets = computeAdaptiveDensityTargets(speech, { existingVisualVarietyPerMin: 3, emotionalIntensityPerMin: 1, hasFootageAnalysis: true }, "BALANCED");
    const text = describeDensityGuidanceForPrompt(targets);
    expect(text).toContain("EDITING RHYTHM FOR THIS VIDEO");
    expect(text).toContain("Why these numbers");
    expect(text).toContain("Slow speaker");
  });

  it("omits the why-these-numbers line when no adjustment fired", () => {
    // A perfectly neutral NORMAL-pace, mid-vocabulary, no-footage-analysis case triggers zero notes.
    const speech = computeSpeechCharacteristics(words(130, 60_000, MID_VOCAB));
    const targets = computeAdaptiveDensityTargets(speech, { existingVisualVarietyPerMin: 0, emotionalIntensityPerMin: 0, hasFootageAnalysis: false }, "BALANCED");
    expect(targets.adjustmentNotes).toEqual([]);
    expect(describeDensityGuidanceForPrompt(targets)).not.toContain("Why these numbers");
  });
});

describe("computeActualDensities + scoreDensityAlignment", () => {
  const neutralTargets = computeAdaptiveDensityTargets(
    computeSpeechCharacteristics(words(130, 60_000, MID_VOCAB)),
    { existingVisualVarietyPerMin: 0, emotionalIntensityPerMin: 0, hasFootageAnalysis: false },
    "BALANCED"
  );

  it("scores a well-aligned plan highly with no misalignments", () => {
    // 60s surviving duration, BALANCED target visualPerMin 8-16/min -> aim
    // for ~10 broll+sticker items, motion 3-8/min -> ~5 zooms, captions
    // averaging ~5 words, sfx within the 0-4/min ceiling, full coverage.
    const captions = Array.from({ length: 12 }, (_, i) => ({
      text: "one two three four five",
      startMs: i * 5000,
      endMs: i * 5000 + 5000,
    }));
    const broll = Array.from({ length: 10 }, (_, i) => ({ startMs: i * 6000, endMs: i * 6000 + 2000, trackHint: "broll" as const, source: "stock" as const }));
    const zoom = Array.from({ length: 5 }, (_, i) => ({ startMs: i * 12000 + 1000, endMs: i * 12000 + 2000, scaleFrom: 100, scaleTo: 110 }));
    const plan = { sceneRemoval: [], captions, zoom, broll, stickers: [], sfx: [{ assetQuery: "whoosh", atMs: 3000 }] };

    const actual = computeActualDensities(plan, 60_000);
    const result = scoreDensityAlignment(actual, neutralTargets);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("flags a video with almost no visual treatment as misaligned on retention and visual density", () => {
    // A single 2s caption at the very start, then 58s of the 60s video with
    // NOTHING covering it (no caption, no broll, no zoom, no sticker) — the
    // "dead air" case the founder's density-calibration request targets.
    const plan = { sceneRemoval: [], captions: [{ text: "hi", startMs: 0, endMs: 2000 }], zoom: [], broll: [], stickers: [], sfx: [] };
    const actual = computeActualDensities(plan, 60_000);
    const result = scoreDensityAlignment(actual, neutralTargets);
    expect(result.score).toBeLessThan(60);
    expect(result.misalignments.some((m) => m.includes("Retention") || m.includes("visual treatment"))).toBe(true);
    expect(result.misalignments.some((m) => m.includes("Visual density"))).toBe(true);
  });

  it("never penalizes ZERO motion density — proposing no zoom is a valid editorial choice", () => {
    const captions = Array.from({ length: 12 }, (_, i) => ({ text: "one two three four five", startMs: i * 5000, endMs: i * 5000 + 5000 }));
    const broll = Array.from({ length: 10 }, (_, i) => ({ startMs: i * 6000, endMs: i * 6000 + 2000, trackHint: "broll" as const, source: "stock" as const }));
    const plan = { sceneRemoval: [], captions, zoom: [], broll, stickers: [], sfx: [] };
    const actual = computeActualDensities(plan, 60_000);
    expect(actual.motionPerMin).toBe(0);
    const result = scoreDensityAlignment(actual, neutralTargets);
    expect(result.misalignments.some((m) => m.includes("Motion density"))).toBe(false);
  });

  it("flags SFX spam (well above the ceiling) as misaligned", () => {
    const captions = Array.from({ length: 12 }, (_, i) => ({ text: "one two three four five", startMs: i * 5000, endMs: i * 5000 + 5000 }));
    const broll = Array.from({ length: 10 }, (_, i) => ({ startMs: i * 6000, endMs: i * 6000 + 2000, trackHint: "broll" as const, source: "stock" as const }));
    const spammySfx = Array.from({ length: 20 }, (_, i) => ({ assetQuery: "pop", atMs: i * 3000 }));
    const plan = { sceneRemoval: [], captions, zoom: [], broll, stickers: [], sfx: spammySfx };
    const actual = computeActualDensities(plan, 60_000);
    const result = scoreDensityAlignment(actual, neutralTargets);
    expect(result.misalignments.some((m) => m.includes("SFX density"))).toBe(true);
  });

  it("computes surviving duration net of scene removal, not raw source duration", () => {
    const plan = {
      sceneRemoval: [{ startMs: 0, endMs: 30_000, reason: "silence" as const }],
      captions: [],
      zoom: [],
      broll: [],
      stickers: [],
      sfx: [],
    };
    const actual = computeActualDensities(plan, 60_000);
    expect(actual.survivingDurationMs).toBeCloseTo(30_000, -2);
  });
});
