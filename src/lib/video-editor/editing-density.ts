// Editing-density calibration (2026-08-08, founder request — "stop
// optimizing prompts in isolation, calibrate against measurable editing
// density"). Pure, deterministic, zero-LLM-cost math — no new agents, no
// new API calls. Shared between the legacy single-call planner
// (ai-edit-jobs.ts) and the AI Video Director pipeline (director/
// orchestrator.ts) so both paths reason about the SAME 5 measurable
// densities instead of a scatter of ad-hoc per-section target counts
// (computeBrollTargetRange's old "N per minute" framing, a fixed zoom
// count ceiling, etc.).
//
// The five densities, all expressed as RHYTHM (events per minute of real
// on-screen time, or a coverage ratio) rather than raw counts — the
// founder's own explicit instruction: "Target editing rhythm instead of
// target clip counts. Do not optimize for clip duration. Optimize for
// viewer engagement":
//   - Visual density   — b-roll/sticker/motion-graphic cutaways per minute
//                         (NEW imagery shown, not a camera move).
//   - Caption density  — average words per caption chunk (a SMALLER chunk
//                         is a HIGHER density/punchier rhythm) — chosen
//                         over "captions per minute" because chunk size is
//                         invariant to speaking rate the way a raw count
//                         isn't (a fast talker naturally produces more
//                         captions/minute at the SAME chunking style).
//   - Motion density   — zoom/camera-punch events per minute.
//   - Audio density    — SFX events per minute (music is scored on its
//                         dynamic-arc shape elsewhere, not count).
//   - Retention density — the fraction (0-1) of the surviving on-screen
//                         time actually covered by SOME visual treatment
//                         (b-roll/zoom/sticker/caption) — the composite
//                         "how much of this would read as dead air"
//                         measure, reusing visual-coverage.ts's own
//                         merge-interval gap detector at a 0ms threshold
//                         (every uncovered millisecond counts, not just
//                         gaps above the no-dead-screen cutoff).
//
// These are honest, documented, DEFENSIBLE heuristics grounded in this
// codebase's own already-established editorial conventions (the
// "genuine visual change every 2-4 seconds" retention-curve language
// already used in gpt5.provider.ts's prompts, "silence is often stronger
// than sound" for SFX, etc.) — not a claim of scientifically measured
// "professional Shorts" data, the same honesty standard
// ai-edit-quality-scoring.ts's own doc comment already holds itself to
// ("an honest, coarse quality SIGNAL... not a claim of true aesthetic
// judgment").

import { computeSourceSurvivingWindows, computeVisualCoverage, findDeadScreenGaps } from "./director/visual-coverage";
import { normalizeSceneRemovalWindows } from "@/app/editor/[projectId]/ai-timeline-translator";
import type { ReasoningZoomItem } from "@/lib/providers/reasoning";
import type { AIBroll, AICaption, AISceneRemoval, AISfx, AISticker } from "@/lib/validations/ai-timeline";

export type EditingDensityPreset = "MINIMAL" | "BALANCED" | "HEAVY";

// ===========================================================================
// Step 1 — real, measured characteristics of THIS specific video, computed
// from data already available before the reasoning call ever runs
// (transcript words + Gemini video-understanding, when present). Zero new
// vendor calls — this is pure arithmetic over existing pipeline output.
// ===========================================================================

export interface SpeechCharacteristics {
  /** Words per minute of ACTUAL spoken time (first word's start to last word's end) — not wall-clock video length. */
  speakingRateWpm: number;
  /**
   * Type-token ratio (unique words / total words), a standard, simple
   * lexical-diversity proxy for "information density" — repetitive/
   * filler-heavy delivery (low diversity) has less distinct content worth
   * illustrating than the same word count spent on varied, specific
   * language (high diversity). 0..1.
   */
  vocabularyRichness: number;
  /** How the caller should describe pacing in the prompt — a coarse bucket, not a raw number the model has to interpret itself. */
  paceBucket: "SLOW" | "NORMAL" | "FAST";
}

const FAST_SPEAKING_WPM = 165;
const SLOW_SPEAKING_WPM = 105;

export function computeSpeechCharacteristics(words: { word: string; startMs: number; endMs: number }[]): SpeechCharacteristics {
  if (words.length === 0) {
    return { speakingRateWpm: 0, vocabularyRichness: 0, paceBucket: "NORMAL" };
  }
  const firstStart = Math.min(...words.map((w) => w.startMs));
  const lastEnd = Math.max(...words.map((w) => w.endMs));
  const spokenMinutes = Math.max(1, lastEnd - firstStart) / 60_000;
  const speakingRateWpm = words.length / spokenMinutes;

  const normalized = words.map((w) => w.word.trim().toLowerCase().replace(/^[.,!?…"'()[\]]+|[.,!?…"'()[\]]+$/g, "")).filter(Boolean);
  const uniqueCount = new Set(normalized).size;
  const vocabularyRichness = normalized.length > 0 ? uniqueCount / normalized.length : 0;

  const paceBucket: SpeechCharacteristics["paceBucket"] = speakingRateWpm >= FAST_SPEAKING_WPM ? "FAST" : speakingRateWpm <= SLOW_SPEAKING_WPM ? "SLOW" : "NORMAL";

  return { speakingRateWpm, vocabularyRichness, paceBucket };
}

export interface FootageCharacteristics {
  /** Distinct visual-context/gesture events per minute of source footage — a proxy for how visually active the RAW footage already is, before any AI-added b-roll/zoom. */
  existingVisualVarietyPerMin: number;
  /** Distinct emotion-beat transitions per minute — a proxy for how emotionally dynamic the delivery already is. */
  emotionalIntensityPerMin: number;
  hasFootageAnalysis: boolean;
}

export interface VideoUnderstandingSummary {
  emphasisMoments: { startMs: number; endMs: number }[];
  emotionBeats: { startMs: number; endMs: number; emotion: string }[];
  visualContext: { startMs: number; endMs: number }[];
  gestures?: { startMs: number; endMs: number }[];
}

export function computeFootageCharacteristics(videoAnalysis: VideoUnderstandingSummary | null, sourceDurationMs: number): FootageCharacteristics {
  if (!videoAnalysis || sourceDurationMs <= 0) {
    return { existingVisualVarietyPerMin: 0, emotionalIntensityPerMin: 0, hasFootageAnalysis: false };
  }
  const minutes = Math.max(1, sourceDurationMs) / 60_000;
  const visualEventCount = videoAnalysis.visualContext.length + (videoAnalysis.gestures?.length ?? 0);
  const existingVisualVarietyPerMin = visualEventCount / minutes;
  const emotionalIntensityPerMin = videoAnalysis.emotionBeats.length / minutes;
  return { existingVisualVarietyPerMin, emotionalIntensityPerMin, hasFootageAnalysis: true };
}

// ===========================================================================
// Step 2 — professional-Shorts baseline rhythm targets. Admin-tunable
// starting points, not hardcoded truths — see lib/admin/config.ts's own
// AI_EDIT_DENSITY_BASELINE entry. Expressed as {min,max} EVENTS PER MINUTE
// (or, for caption density, avg words/caption; for retention density, a
// 0-1 coverage ratio) at BALANCED density — MINIMAL/HEAVY scale this
// baseline, then the adaptive step below further adjusts for THIS video.
// ===========================================================================

export interface DensityRange {
  min: number;
  max: number;
}

export interface DensityBaseline {
  visualPerMin: DensityRange;
  captionAvgWords: DensityRange; // smaller = punchier/denser
  motionPerMin: DensityRange;
  audioPerMin: DensityRange;
  retentionCoverageRatio: DensityRange;
}

// BALANCED baseline — grounded in this codebase's own pre-existing
// editorial language: "a genuine visual change roughly every 2-4 seconds"
// (visual+motion combined ≈ 15-30/min; split roughly 2:1 visual:motion
// since a b-roll/sticker cutaway is used more freely than a zoom), viral
// caption chunks are short declarative phrases (3-7 words), zoom used
// more sparingly than b-roll, SFX very sparse ("silence is often stronger
// than sound"), and at most ~10-15% of a professionally cut Short reading
// as visually static.
const BALANCED_BASELINE: DensityBaseline = {
  visualPerMin: { min: 8, max: 16 },
  captionAvgWords: { min: 3, max: 7 },
  motionPerMin: { min: 3, max: 8 },
  audioPerMin: { min: 0, max: 4 },
  retentionCoverageRatio: { min: 0.85, max: 1 },
};

const DENSITY_PRESET_MULTIPLIER: Record<EditingDensityPreset, number> = {
  MINIMAL: 0.5,
  BALANCED: 1,
  HEAVY: 1.75,
};

function scaleRange(range: DensityRange, multiplier: number, opts?: { invert?: boolean }): DensityRange {
  // "invert" — caption avg words gets SMALLER (punchier) as density goes
  // UP, the opposite direction from every other range, which gets LARGER.
  const factor = opts?.invert ? 1 / multiplier : multiplier;
  return { min: Math.max(0, range.min * factor), max: Math.max(range.min * factor, range.max * factor) };
}

function presetBaseline(preset: EditingDensityPreset | undefined): DensityBaseline {
  const multiplier = DENSITY_PRESET_MULTIPLIER[preset ?? "BALANCED"];
  return {
    visualPerMin: scaleRange(BALANCED_BASELINE.visualPerMin, multiplier),
    captionAvgWords: scaleRange(BALANCED_BASELINE.captionAvgWords, multiplier, { invert: true }),
    motionPerMin: scaleRange(BALANCED_BASELINE.motionPerMin, multiplier),
    audioPerMin: scaleRange(BALANCED_BASELINE.audioPerMin, multiplier),
    // Retention coverage is a ratio, never scaled by density preset — even
    // a MINIMAL edit shouldn't read as mostly dead air; density presets
    // change HOW MUCH decoration is added, not whether the video holds
    // attention at all.
    retentionCoverageRatio: BALANCED_BASELINE.retentionCoverageRatio,
  };
}

// ===========================================================================
// Step 3 — adaptive per-video targets. Same preset, different real output:
// a slow speaker gets MORE visual support, a fast energetic speaker gets
// FEWER interruptions (the founder's own explicit examples), footage that
// already has real visual variety needs less added b-roll, high emotional
// intensity earns a little more motion (emphasis zooms land better on
// genuine emotional beats) but LESS added SFX (a real emotional beat needs
// room to breathe, not a sound effect competing with it), and higher
// lexical/information density earns more visual support (more distinct
// real content worth illustrating).
// ===========================================================================

export interface AdaptiveDensityTargets {
  baseline: DensityBaseline;
  adapted: DensityBaseline;
  speech: SpeechCharacteristics;
  footage: FootageCharacteristics;
  /** Human-readable notes on WHY each adjustment was made — surfaced in both the prompt guidance and structured logs, never a silent multiplier. */
  adjustmentNotes: string[];
}

// Bounded to +/-30% per factor so no combination of signals can push the
// adaptive target wildly outside the preset's own intent — this is
// calibration, not a license for the heuristic to invent an unrecognizable
// density.
const MAX_ADJUSTMENT = 0.3;

export function computeAdaptiveDensityTargets(
  speech: SpeechCharacteristics,
  footage: FootageCharacteristics,
  preset: EditingDensityPreset | undefined
): AdaptiveDensityTargets {
  const baseline = presetBaseline(preset);
  const notes: string[] = [];
  let visualMotionMultiplier = 1;
  let motionOnlyMultiplier = 1;
  let audioMultiplier = 1;

  // Speaking pace — the founder's own explicit calibration examples.
  if (speech.paceBucket === "FAST") {
    visualMotionMultiplier -= 0.2;
    notes.push(`Fast speaker (~${Math.round(speech.speakingRateWpm)} wpm) — fewer visual interruptions so cuts don't fight the pace.`);
  } else if (speech.paceBucket === "SLOW") {
    visualMotionMultiplier += 0.25;
    notes.push(`Slow speaker (~${Math.round(speech.speakingRateWpm)} wpm) — more visual support to sustain attention during slower delivery.`);
  }

  // Footage already visually active — less needs adding.
  if (footage.hasFootageAnalysis) {
    if (footage.existingVisualVarietyPerMin >= 6) {
      visualMotionMultiplier -= 0.15;
      notes.push(`Raw footage already has real visual variety (~${footage.existingVisualVarietyPerMin.toFixed(1)}/min) — less added b-roll needed.`);
    } else if (footage.existingVisualVarietyPerMin <= 1) {
      visualMotionMultiplier += 0.15;
      notes.push("Raw footage is visually static (one unchanging setting) — more added visual support needed.");
    }

    // Emotional intensity — earns a LITTLE more motion (emphasis zooms
    // land well on real emotional beats) but LESS sfx (let it breathe).
    if (footage.emotionalIntensityPerMin >= 3) {
      motionOnlyMultiplier += 0.15;
      audioMultiplier -= 0.25;
      notes.push(`High emotional variety (~${footage.emotionalIntensityPerMin.toFixed(1)} beats/min) — a little more motion to punctuate it, less SFX so the moment isn't undercut.`);
    }
  }

  // Vocabulary richness — more distinct real content earns more visual support.
  if (speech.vocabularyRichness >= 0.65) {
    visualMotionMultiplier += 0.1;
    notes.push(`High lexical variety (${Math.round(speech.vocabularyRichness * 100)}% unique words) — more distinct content worth illustrating.`);
  } else if (speech.vocabularyRichness > 0 && speech.vocabularyRichness <= 0.4) {
    visualMotionMultiplier -= 0.1;
    notes.push(`Repetitive/filler-heavy delivery (${Math.round(speech.vocabularyRichness * 100)}% unique words) — less real content to illustrate, avoid over-decorating repetition.`);
  }

  const clampMultiplier = (m: number) => Math.max(1 - MAX_ADJUSTMENT, Math.min(1 + MAX_ADJUSTMENT, m));
  visualMotionMultiplier = clampMultiplier(visualMotionMultiplier);
  motionOnlyMultiplier = clampMultiplier(motionOnlyMultiplier);
  audioMultiplier = clampMultiplier(audioMultiplier);

  const adapted: DensityBaseline = {
    visualPerMin: scaleRange(baseline.visualPerMin, visualMotionMultiplier),
    // Caption chunking rhythm is a STYLE choice (viral punchiness), not a
    // function of speaking pace/footage — deliberately NOT adapted here.
    captionAvgWords: baseline.captionAvgWords,
    motionPerMin: scaleRange(baseline.motionPerMin, visualMotionMultiplier * motionOnlyMultiplier),
    audioPerMin: scaleRange(baseline.audioPerMin, audioMultiplier),
    retentionCoverageRatio: baseline.retentionCoverageRatio,
  };

  return { baseline, adapted, speech, footage, adjustmentNotes: notes };
}

// ===========================================================================
// Step 4 — turn the adaptive targets into natural-language guidance for
// the SAME existing single reasoning prompt (legacy buildPrompt() and
// Director's buildVisualsPrompt/buildAudioPrompt) — replacing the old flat
// "N b-roll slots for this video's length" framing with a rhythm-based
// instruction that already accounts for this video's own pace/footage/
// content characteristics.
// ===========================================================================

export function describeDensityGuidanceForPrompt(targets: AdaptiveDensityTargets): string {
  const { adapted } = targets;
  const visualEveryMs = Math.round(60_000 / Math.max(1, adapted.visualPerMin.max));
  const visualEveryMsLoose = Math.round(60_000 / Math.max(1, adapted.visualPerMin.min));
  const motionEveryMs = Math.round(60_000 / Math.max(1, adapted.motionPerMin.max));
  const motionEveryMsLoose = Math.round(60_000 / Math.max(1, adapted.motionPerMin.min));

  const lines = [
    `EDITING RHYTHM FOR THIS VIDEO — calibrated to this video's own pace and content, not a fixed count. Aim for a genuine NEW visual (b-roll cutaway, sticker, or motion graphic) roughly every ${(visualEveryMs / 1000).toFixed(1)}-${(visualEveryMsLoose / 1000).toFixed(1)} seconds of screen time on average — a RHYTHM to feel out over the whole video, never a quota to hit mechanically or a fixed interval to repeat.`,
    `Camera motion (zoom) should land roughly every ${(motionEveryMs / 1000).toFixed(1)}-${(motionEveryMsLoose / 1000).toFixed(1)} seconds ON AVERAGE when the speech actually motivates it (a question, a number, real emphasis) — skip it entirely for stretches with no real trigger rather than forcing one to hit this rhythm.`,
    `Caption chunks should average roughly ${adapted.captionAvgWords.min}-${adapted.captionAvgWords.max} words each — short, punchy, declarative, not full sentences.`,
    `SFX should land at most ${Math.max(1, Math.round(adapted.audioPerMin.max))} times total for the whole video at this length — silence is the default; only use one where a real event genuinely earns it.`,
    `No stretch of screen time should go much longer than ${Math.round((1 - adapted.retentionCoverageRatio.min) * 100)}% of the video's total length with absolutely nothing visual happening.`,
  ];
  if (targets.adjustmentNotes.length > 0) {
    lines.push(`Why these numbers, specifically for THIS video: ${targets.adjustmentNotes.join(" ")}`);
  }
  return lines.join("\n");
}

// ===========================================================================
// Step 5 — measure the ACTUAL generated plan's densities (post-hoc,
// deterministic, zero LLM cost) and score how well it converged toward the
// adaptive target — feeds the EXISTING bounded quality-retry (both
// pipelines already have one; this doesn't add a new one).
// ===========================================================================

export interface ActualDensities {
  visualPerMin: number;
  captionAvgWords: number;
  motionPerMin: number;
  audioPerMin: number;
  retentionCoverageRatio: number;
  survivingDurationMs: number;
}

export function computeActualDensities(
  plan: { sceneRemoval: AISceneRemoval[]; captions: AICaption[]; zoom: ReasoningZoomItem[]; broll: AIBroll[]; stickers: AISticker[]; sfx: AISfx[] },
  sourceDurationMs: number
): ActualDensities {
  const survivingWindows = computeSourceSurvivingWindows(sourceDurationMs, normalizeSceneRemovalWindows(plan.sceneRemoval.map((r) => ({ startMs: r.startMs, endMs: r.endMs }))));
  const survivingDurationMs = survivingWindows.reduce((sum, w) => sum + (w.endMs - w.startMs), 0);
  const minutes = Math.max(1, survivingDurationMs) / 60_000;

  const visualCount = plan.broll.length + plan.stickers.length;
  const captionWords = plan.captions.map((c) => c.text.split(/\s+/).filter(Boolean).length);
  const captionAvgWords = captionWords.length > 0 ? captionWords.reduce((a, b) => a + b, 0) / captionWords.length : 0;

  const coverage = computeVisualCoverage({ broll: plan.broll, zoom: plan.zoom, stickers: plan.stickers, captions: plan.captions });
  const uncoveredGaps = findDeadScreenGaps(coverage, survivingWindows, 0);
  const uncoveredMs = uncoveredGaps.reduce((sum, g) => sum + g.durationMs, 0);
  const retentionCoverageRatio = survivingDurationMs > 0 ? Math.max(0, 1 - uncoveredMs / survivingDurationMs) : 1;

  return {
    visualPerMin: visualCount / minutes,
    captionAvgWords,
    motionPerMin: plan.zoom.length / minutes,
    audioPerMin: plan.sfx.length / minutes,
    retentionCoverageRatio,
    survivingDurationMs,
  };
}

export interface DensityAlignmentResult {
  /** 0-100 — how well the actual output matches the adaptive targets across all 5 dimensions. */
  score: number;
  misalignments: string[];
}

function rangeFit(value: number, range: DensityRange): number {
  if (value >= range.min && value <= range.max) return 1;
  if (value < range.min) return range.min > 0 ? Math.max(0, value / range.min) : 1;
  return Math.max(0, 1 - (value - range.max) / Math.max(1, range.max));
}

export function scoreDensityAlignment(actual: ActualDensities, targets: AdaptiveDensityTargets): DensityAlignmentResult {
  const { adapted } = targets;
  const misalignments: string[] = [];

  const visualFit = rangeFit(actual.visualPerMin, adapted.visualPerMin);
  if (visualFit < 0.6) misalignments.push(`Visual density ${actual.visualPerMin.toFixed(1)}/min is outside the ${adapted.visualPerMin.min.toFixed(1)}-${adapted.visualPerMin.max.toFixed(1)}/min target.`);

  const captionFit = actual.captionAvgWords > 0 ? rangeFit(actual.captionAvgWords, adapted.captionAvgWords) : 0.5;
  if (captionFit < 0.6) misalignments.push(`Caption chunks average ${actual.captionAvgWords.toFixed(1)} words, outside the ${adapted.captionAvgWords.min}-${adapted.captionAvgWords.max} target.`);

  const motionFit = rangeFit(actual.motionPerMin, adapted.motionPerMin);
  // Zero motion is never itself a penalty — the prompt explicitly allows
  // skipping it entirely when nothing motivates it; only PENALIZE being
  // above the ceiling (over-zooming), matching "quality over quantity" for
  // this specific dimension.
  const motionFitFloorSafe = actual.motionPerMin === 0 ? 1 : motionFit;
  if (motionFitFloorSafe < 0.6) misalignments.push(`Motion density ${actual.motionPerMin.toFixed(1)}/min exceeds the ${adapted.motionPerMin.max.toFixed(1)}/min ceiling.`);

  const audioFit = actual.audioPerMin <= adapted.audioPerMin.max ? 1 : Math.max(0, 1 - (actual.audioPerMin - adapted.audioPerMin.max) / Math.max(1, adapted.audioPerMin.max));
  if (audioFit < 0.6) misalignments.push(`SFX density ${actual.audioPerMin.toFixed(1)}/min exceeds the ${adapted.audioPerMin.max.toFixed(1)}/min ceiling.`);

  const retentionFit = actual.retentionCoverageRatio >= adapted.retentionCoverageRatio.min ? 1 : actual.retentionCoverageRatio / Math.max(0.01, adapted.retentionCoverageRatio.min);
  if (retentionFit < 0.6) misalignments.push(`Only ${Math.round(actual.retentionCoverageRatio * 100)}% of the video has any visual treatment, below the ${Math.round(adapted.retentionCoverageRatio.min * 100)}% target.`);

  // Retention weighted heaviest (it's the composite engagement measure the
  // founder's own instruction centers on — "optimize for viewer
  // engagement"), then visual, then the rest evenly.
  const score = Math.round((retentionFit * 30 + visualFit * 25 + captionFit * 15 + motionFitFloorSafe * 15 + audioFit * 15) * 1);
  return { score: Math.max(0, Math.min(100, score)), misalignments };
}
