import { computeBrollTargetRange } from "@/lib/providers/reasoning/gpt5.provider";
import type { AIBroll, AICaption, AISceneRemoval, AIZoom } from "@/lib/validations/ai-timeline";

// TASK 12 (2026-08-07, founder request — "quality scoring") — pure,
// deterministic, independently-testable heuristics over an already-
// assembled AITimelinePlan. Deliberately NOT an ML model or a second
// vendor call: every real production-rules standing instruction for AI-
// layer work in this codebase (no mock/placeholder data, one
// responsibility per layer) points at "compute this from data we already
// have," not "invent a plausible-looking number." These scores are an
// honest, coarse quality SIGNAL — good for flagging a genuinely thin or
// unbalanced plan and deciding whether a bounded retry is worth it (see
// ai-edit-jobs.ts's own use of this), not a claim of true aesthetic
// judgment.

export interface AiEditQualityScores {
  /** 0-100. Simple average of the three below — one headline number for the review UI. */
  editingScore: number;
  /** 0-100. Caption coverage of the spoken content + viral-style signals (power-word highlighting, punchy line length). */
  captionScore: number;
  /** 0-100. B-roll count vs. the requested density's own target range, plus zoom/sticker presence. */
  visualScore: number;
  /** 0-100. How evenly captions/visual beats are paced across the video, plus real silence removal. */
  pacingScore: number;
}

// Exported (2026-08-07) — the AI Video Director's own quality-review.ts
// reuses this and scoreCaptions/scorePacing directly rather than a
// second, drifting copy of the same coverage/brevity/pacing math.
export function clamp0to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Caption coverage: what fraction of the video's own duration is actually
// spanned by SOME caption — a plan with long silent (caption-less)
// stretches during real speech reads as unfinished, not stylistically
// sparse. Overlap-safe (captions are already non-overlapping by
// construction, but this doesn't assume that).
function captionCoverageFraction(captions: AICaption[], sourceDurationMs: number): number {
  if (sourceDurationMs <= 0) return 0;
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  let coveredMs = 0;
  let cursor = 0;
  for (const c of sorted) {
    const start = Math.max(cursor, c.startMs);
    const end = Math.max(start, c.endMs);
    coveredMs += Math.max(0, end - start);
    cursor = Math.max(cursor, end);
  }
  return Math.min(1, coveredMs / sourceDurationMs);
}

export function scoreCaptions(captions: AICaption[], sourceDurationMs: number): number {
  if (captions.length === 0) return 0;
  const coverage = captionCoverageFraction(captions, sourceDurationMs); // 0..1
  const withHighlight = captions.filter((c) => c.highlightWords && c.highlightWords.length > 0).length;
  const highlightRate = withHighlight / captions.length; // 0..1 — viral-style signal, not required on every caption
  // Average words per caption — the caption-formatting module's own hard
  // cap is 12 (2 lines x 6 words); a plan whose captions average well
  // under that reads as punchy short-form style, whereas long, sentence-
  // length captions read as plain subtitles.
  const avgWords = captions.reduce((sum, c) => sum + c.text.split(/\s+/).filter(Boolean).length, 0) / captions.length;
  const brevityScore = avgWords <= 6 ? 1 : avgWords <= 9 ? 0.7 : avgWords <= 12 ? 0.4 : 0.1;
  // Weighted: coverage matters most (a gap in captioning is the most
  // visible defect), then brevity (the "viral, not a transcript" ask),
  // then highlight usage (a nice-to-have signal, not mandatory on every
  // caption — real viral edits highlight SOME words, not all of them).
  return clamp0to100(coverage * 60 + brevityScore * 25 + highlightRate * 15);
}

// FLAGGED, NOT FIXED (2026-08-07, found while building the AI Video
// Director's own quality-review.ts, which deliberately does NOT repeat
// this) — `resolvedCount` below filters on `resolvedAssetId`, but
// scoreAiTimelinePlan is invoked from ai-edit-jobs.ts's attemptPlanning()
// during PLANNING_TIMELINE, which runs BEFORE RESOLVING_ASSETS ever sets
// resolvedAssetId on any broll item (see aiBrollSchema's own doc comment
// in validations/ai-timeline.ts — "filled in by a LATER module, not this
// one"). In production this means `resolvedCount` is effectively ALWAYS
// 0 at the point this function actually runs, so `brollFit` is always 0
// and `visualScore` is capped at ~20 (zoom/sticker bonuses only)
// regardless of how well the b-roll plan actually matches the requested
// density — which in turn means the bounded quality retry (AI_EDIT_
// QUALITY_RETRY_THRESHOLD, 55) likely fires on nearly every run that
// includes broll/zoom/stickers, silently doubling reasoning cost. NOT
// fixed here deliberately — this function's exact behavior is the "zero
// behavior change to the legacy path" contract this session's AI Video
// Director work is built on (see PROJECT_STATUS.md / the final report);
// changing it would alter legacy retry frequency, which is out of this
// task's scope. Flagged for a dedicated follow-up fix (likely: count
// proposed items directly, `broll.length`, since resolution hasn't
// happened yet at this point in the pipeline — the AI Video Director's
// own quality-review.ts does exactly this for its equivalent brollScore).
function scoreVisuals(
  broll: AIBroll[],
  zoom: AIZoom[],
  stickers: unknown[],
  ctx: { sourceDurationMs: number; brollDensity?: "MINIMAL" | "BALANCED" | "HEAVY" }
): number {
  const { min, max } = computeBrollTargetRange(ctx.sourceDurationMs, ctx.brollDensity);
  const resolvedCount = broll.filter((b) => b.resolvedAssetId).length;
  // 1.0 anywhere inside [min,max]; degrades linearly outside it — being
  // BELOW the target (the founder's own reported complaint — "heavy
  // sometimes inserts only one clip") is scored the same way as being
  // above it, since both mean the plan doesn't match the requested
  // density.
  const brollFit =
    resolvedCount >= min && resolvedCount <= max
      ? 1
      : resolvedCount < min
        ? Math.max(0, resolvedCount / Math.max(1, min))
        : Math.max(0, 1 - (resolvedCount - max) / Math.max(1, max));
  const zoomBonus = zoom.length > 0 ? 1 : 0;
  const stickerBonus = stickers.length > 0 ? 1 : 0;
  // B-roll fit dominates (it's the visual backbone this task cares most
  // about); zoom/stickers are smaller bonuses on top — their ABSENCE
  // should never tank an otherwise-good b-roll plan, since both are
  // legitimately optional per the reasoning prompt's own "propose zero
  // far more often than not" guidance.
  return clamp0to100(brollFit * 80 + zoomBonus * 12 + stickerBonus * 8);
}

// Pacing: (1) real silence/filler removal happened (a plan that removed
// nothing from a real talking-head recording is suspicious, not just
// "conservative" — see FIX 3/TASK 7's own adaptive detector, which should
// find SOMETHING in almost any unscripted recording); (2) captions don't
// leave any single gap larger than a generous ceiling, which would read
// as a long dead stretch with no on-screen text to hold attention.
export function scorePacing(sceneRemoval: AISceneRemoval[], captions: AICaption[], sourceDurationMs: number): number {
  const removalScore = sceneRemoval.length > 0 ? 1 : 0.4; // not zero — a genuinely clean recording with nothing to cut is possible, just less common
  let largestGapMs = 0;
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  let cursor = 0;
  for (const c of sorted) {
    largestGapMs = Math.max(largestGapMs, c.startMs - cursor);
    cursor = Math.max(cursor, c.endMs);
  }
  largestGapMs = Math.max(largestGapMs, sourceDurationMs - cursor);
  const gapCeilingMs = 8000; // an 8s+ caption-less stretch is a real pacing gap, not stylistic breathing room
  const gapScore = captions.length === 0 ? 0 : Math.max(0, 1 - largestGapMs / gapCeilingMs);
  return clamp0to100(removalScore * 40 + gapScore * 60);
}

export interface AiEditQualityScoringContext {
  sourceDurationMs: number;
  brollDensity?: "MINIMAL" | "BALANCED" | "HEAVY";
  // Real bug found while wiring this up (2026-08-07) — an EARLIER version
  // of this function always averaged all three dimensions unconditionally.
  // The founder's own module-selection feature (2026-07-30) lets a run
  // deliberately request only SOME sections (e.g. "captions" alone); an
  // empty broll/zoom/stickers section in that case is a deliberate
  // omission, not a quality defect, but the unconditional average scored
  // it as a defect anyway and wrongly tripped the quality-triggered retry
  // below for module-selection runs that were working exactly as
  // intended. Caught by this module's own test suite immediately, before
  // it reached ai-edit-jobs.ts's real integration. Per-dimension scores
  // are still always computed and returned (useful for display even when
  // out of scope for the aggregate) — only the AGGREGATE `editingScore`
  // excludes a dimension whose modules weren't part of this run.
  captionsInScope: boolean;
  visualInScope: boolean; // true when broll and/or zoom and/or stickers was selected
  pacingInScope: boolean; // true when sceneRemoval and/or captions was selected
}

export function scoreAiTimelinePlan(
  plan: { sceneRemoval: AISceneRemoval[]; captions: AICaption[]; zoom: AIZoom[]; broll: AIBroll[]; stickers: unknown[] },
  ctx: AiEditQualityScoringContext
): AiEditQualityScores {
  const captionScore = scoreCaptions(plan.captions, ctx.sourceDurationMs);
  const visualScore = scoreVisuals(plan.broll, plan.zoom, plan.stickers, ctx);
  const pacingScore = scorePacing(plan.sceneRemoval, plan.captions, ctx.sourceDurationMs);

  const inScopeDimensions = [
    ctx.captionsInScope ? captionScore : null,
    ctx.visualInScope ? visualScore : null,
    ctx.pacingInScope ? pacingScore : null,
  ].filter((d): d is number => d !== null);
  // No dimension in scope shouldn't be reachable in practice (the caller
  // only invokes this when at least one TIMELINE_PLANNING_MODULES module
  // was selected), but defaults to a neutral 100 rather than a misleading
  // 0 if it ever is — there is nothing to have scored poorly.
  const editingScore = inScopeDimensions.length > 0 ? clamp0to100(inScopeDimensions.reduce((a, b) => a + b, 0) / inScopeDimensions.length) : 100;

  return { editingScore, captionScore, visualScore, pacingScore };
}

// Founder request — "if score is poor, automatically regenerate ... never
// regenerate the whole edit." Below this, ai-edit-jobs.ts attempts ONE
// bounded extra planTimeline() call (never a loop) when the FIRST
// attempt's editingScore is below this bar, keeping whichever attempt
// scored higher — see that file's own doc comment for why a true
// PER-SECTION regeneration isn't architecturally available (captions/
// zoom/broll/stickers/music/sfx/transitions all come back from ONE
// combined reasoning call; there's no way to ask the model to redo just
// one section without a second full call).
export const AI_EDIT_QUALITY_RETRY_THRESHOLD = 55;
