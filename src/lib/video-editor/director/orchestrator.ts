import { getConfig } from "@/lib/admin/config";
import { normalizeSceneRemovalWindows } from "@/app/editor/[projectId]/ai-timeline-translator";
import { planAudio as planAudioAgent, planDirectorCaptions, planStory as planStoryAgent, planVisuals as planVisualsAgent, reviewQuality as reviewQualityAgent } from "@/lib/generation/reasoning";
import type { ReasoningAudioRequest, ReasoningCaptionRequest, ReasoningQualityReviewRequest, ReasoningStoryRequest, ReasoningVisualsRequest } from "@/lib/providers/reasoning";
import type { AiQualityCategory, AiQualityScoresV2 } from "@/lib/validations/ai-timeline";
import { buildMusicVolumeEnvelope } from "./music-envelope";
import { buildQualityScoresV2, computeDeterministicScores, countTrailingNonImproving, resolveAgentsToRerun, STAGNATION_ROUNDS } from "./quality-review";
import type { DirectorAgentId, DirectorContext, DirectorIterationEntry, DirectorJobMeta, DirectorPipelineResult, SpeechAnalysisOutput, VideoAnalysisOutput } from "./types";
import { applyNoDeadScreenFixes, computeSourceSurvivingWindows, computeVisualCoverage, findDeadScreenGaps } from "./visual-coverage";
import { createEmptyVarietyLedger, recordManyUsages, zoomStyleBucket } from "./variety-ledger";

// AI Video Director (2026-08-07) — the multi-agent pipeline's orchestrator.
// Replaces the legacy single-call attemptPlanning()'s role in
// ai-edit-jobs.ts, but ONLY when AI_EDIT_DIRECTOR_PIPELINE_ENABLED is on
// (see that file's PLANNING_TIMELINE stage) — the legacy path is kept
// byte-identical and fully intact for the flag-off case.

async function runStoryAgent(ctx: DirectorContext): Promise<DirectorContext> {
  // Story always runs when the pipeline is invoked at all (ai-edit-jobs.ts
  // only calls this when at least one of the 7 legacy modules was
  // selected) — it's the cheap shared narrative context every other agent
  // benefits from, not gated behind any single module.
  const req: ReasoningStoryRequest = {
    words: ctx.speech.words,
    videoAnalysis: ctx.videoAnalysis,
    stylePreset: ctx.jobMeta.stylePreset,
    referenceScript: ctx.jobMeta.referenceScript,
    sourceDurationMs: ctx.speech.sourceDurationMs,
    repairMaxAttempts: ctx.jobMeta.repairMaxAttempts,
  };
  const result = await planStoryAgent(req, { userId: ctx.jobMeta.userId });
  return {
    ...ctx,
    story: {
      beats: result.beats,
      hookText: result.hookText,
      hookStrengthReason: result.hookStrengthReason,
      retentionScore: result.retentionScore,
      retentionRisks: result.retentionRisks,
      ctaPresent: result.ctaPresent,
      ctaText: result.ctaText,
    },
    reasoningCostUsd: ctx.reasoningCostUsd + (result.costUsd ?? 0),
    warnings: result.warnings && result.warnings.length > 0 ? [...ctx.warnings, ...result.warnings] : ctx.warnings,
  };
}

async function runCaptionAgent(ctx: DirectorContext): Promise<DirectorContext> {
  if (!ctx.wantsModule("captions")) return ctx;
  const req: ReasoningCaptionRequest = {
    words: ctx.speech.words,
    stylePreset: ctx.jobMeta.stylePreset,
    referenceScript: ctx.jobMeta.referenceScript,
    storyBeats: ctx.story?.beats ?? [],
    hookText: ctx.story?.hookText,
    ctaText: ctx.story?.ctaText,
    repairMaxAttempts: ctx.jobMeta.repairMaxAttempts,
  };
  const result = await planDirectorCaptions(req, { userId: ctx.jobMeta.userId });
  const ledger = recordManyUsages(
    ctx.varietyLedger,
    "captionAnimations",
    result.captions.map((c) => c.reveal?.mode ?? "NONE")
  );
  return {
    ...ctx,
    captions: result.captions,
    varietyLedger: ledger,
    reasoningCostUsd: ctx.reasoningCostUsd + (result.costUsd ?? 0),
    warnings: result.warnings && result.warnings.length > 0 ? [...ctx.warnings, ...result.warnings] : ctx.warnings,
  };
}

async function runVisualsAgent(ctx: DirectorContext): Promise<DirectorContext> {
  if (!ctx.wantsModule("zoom") && !ctx.wantsModule("broll") && !ctx.wantsModule("stickers") && !ctx.wantsModule("transitions")) return ctx;
  const req: ReasoningVisualsRequest = {
    words: ctx.speech.words,
    videoAnalysis: ctx.videoAnalysis,
    captions: ctx.captions,
    storyBeats: ctx.story?.beats ?? [],
    brollDensity: ctx.jobMeta.brollDensity,
    brollStockOnly: ctx.jobMeta.brollStockOnly,
    sourceDurationMs: ctx.speech.sourceDurationMs,
    survivingSegmentCount: ctx.speech.survivingSegmentCount,
    usedZoomStyles: ctx.varietyLedger.zoomStyles,
    usedTransitionTypes: ctx.varietyLedger.transitionTypes,
    usedStickerQueries: ctx.varietyLedger.stickerQueries,
    usedBrollStyles: ctx.varietyLedger.brollStyles,
    repairMaxAttempts: ctx.jobMeta.repairMaxAttempts,
    densityGuidance: ctx.jobMeta.densityGuidance,
  };
  const result = await planVisualsAgent(req, { userId: ctx.jobMeta.userId });
  const zoom = ctx.wantsModule("zoom") ? result.zoom : [];
  const broll = ctx.wantsModule("broll") ? result.broll : [];
  const stickers = ctx.wantsModule("stickers") ? result.stickers : [];
  const transitions = ctx.wantsModule("transitions") ? result.transitions : [];

  let ledger = ctx.varietyLedger;
  // Quality upgrade (2026-08-07, TASK 5) — the Visuals agent now names a
  // real style directly (fast_punch/slow_push/etc.); zoomStyleBucket's own
  // scale-delta heuristic is only a fallback for the rare case the model
  // omitted "style" (or for legacy-shaped zoom items with no style field
  // at all).
  ledger = recordManyUsages(
    ledger,
    "zoomStyles",
    zoom.map((z) => z.style ?? zoomStyleBucket(z.scaleFrom, z.scaleTo))
  );
  ledger = recordManyUsages(
    ledger,
    "transitionTypes",
    transitions.map((t) => t.type)
  );
  ledger = recordManyUsages(
    ledger,
    "stickerQueries",
    stickers.map((s) => s.assetQuery ?? "").filter(Boolean)
  );
  ledger = recordManyUsages(
    ledger,
    "brollStyles",
    broll.map((b) => b.contentKind ?? "broll")
  );

  return {
    ...ctx,
    zoom,
    broll,
    stickers,
    transitions,
    varietyLedger: ledger,
    reasoningCostUsd: ctx.reasoningCostUsd + (result.costUsd ?? 0),
    warnings: result.warnings && result.warnings.length > 0 ? [...ctx.warnings, ...result.warnings] : ctx.warnings,
  };
}

async function runAudioAgent(ctx: DirectorContext): Promise<DirectorContext> {
  if (!ctx.wantsModule("music") && !ctx.wantsModule("sfx")) return ctx;
  const req: ReasoningAudioRequest = {
    words: ctx.speech.words,
    storyBeats: ctx.story?.beats ?? [],
    captions: ctx.captions,
    broll: ctx.broll,
    transitions: ctx.transitions,
    sourceDurationMs: ctx.speech.sourceDurationMs,
    usedSfxQueries: ctx.varietyLedger.sfxQueries,
    repairMaxAttempts: ctx.jobMeta.repairMaxAttempts,
    densityGuidance: ctx.jobMeta.densityGuidance,
  };
  const result = await planAudioAgent(req, { userId: ctx.jobMeta.userId });
  // TASK 7 (2026-08-07, "music should evolve") — deterministic, computed
  // from the already-planned story beats, zero extra reasoning cost. See
  // music-envelope.ts's own doc comment for the beat->energy mapping.
  const music =
    ctx.wantsModule("music") && result.music
      ? { ...result.music, volumeEnvelope: buildMusicVolumeEnvelope(ctx.story?.beats ?? [], ctx.speech.sourceDurationMs) }
      : undefined;
  const sfx = ctx.wantsModule("sfx") ? result.sfx : [];
  const ledger = recordManyUsages(
    ctx.varietyLedger,
    "sfxQueries",
    sfx.map((s) => s.assetQuery ?? "").filter(Boolean)
  );
  return {
    ...ctx,
    music,
    sfx,
    varietyLedger: ledger,
    reasoningCostUsd: ctx.reasoningCostUsd + (result.costUsd ?? 0),
    warnings: result.warnings && result.warnings.length > 0 ? [...ctx.warnings, ...result.warnings] : ctx.warnings,
  };
}

// Runs the requested agents IN THEIR DATA-DEPENDENCY ORDER regardless of
// what order they're listed in — story must always precede captions,
// captions before visuals, visuals before audio, since each downstream
// agent reads the previous one's output off `ctx`.
async function runAgentsInOrder(ctx: DirectorContext, agents: DirectorAgentId[]): Promise<DirectorContext> {
  const want = new Set(agents);
  let next = ctx;
  if (want.has("story")) next = await runStoryAgent(next);
  if (want.has("captions")) next = await runCaptionAgent(next);
  if (want.has("visuals")) next = await runVisualsAgent(next);
  if (want.has("audio")) next = await runAudioAgent(next);
  return next;
}

// Deterministic — no LLM call, safe to run after every regeneration that
// touched broll/zoom/stickers/captions. See visual-coverage.ts for the
// Phase-1-scope explanation (5 in-scope visual types only).
function applyNoDeadScreenPass(ctx: DirectorContext, gapThresholdMs: number): DirectorContext {
  const survivingWindows = computeSourceSurvivingWindows(
    ctx.speech.sourceDurationMs,
    normalizeSceneRemovalWindows(ctx.speech.sceneRemoval.map((r) => ({ startMs: r.startMs, endMs: r.endMs })))
  );
  const coverage = computeVisualCoverage({ broll: ctx.broll, zoom: ctx.zoom, stickers: ctx.stickers, captions: ctx.captions });
  const gaps = findDeadScreenGaps(coverage, survivingWindows, gapThresholdMs);
  if (gaps.length === 0) return ctx;

  const fixes = applyNoDeadScreenFixes(gaps, ctx.captions, ctx.varietyLedger, {
    words: ctx.speech.words,
    visualContext: ctx.videoAnalysis?.visualContext,
    existingBroll: ctx.broll,
  });
  return {
    ...ctx,
    broll: [...ctx.broll, ...fixes.broll],
    zoom: [...ctx.zoom, ...fixes.zoom],
    stickers: [...ctx.stickers, ...fixes.stickers],
    varietyLedger: fixes.ledger,
  };
}

interface ScoreOutcome {
  scores: AiQualityScoresV2;
  costUsd: number;
  warnings: string[];
}

// Deterministic categories are computed locally (zero cost); the 3
// LLM-judged categories come from one reviewQuality() call. Never throws
// silently swallowed — a failure here propagates to the caller, which
// decides (first pass: fatal to the Director attempt; loop iterations:
// caught, loop stops, best-so-far kept — see runDirectorPipeline below).
async function scoreDirectorPlan(
  ctx: DirectorContext,
  opts: { targetScore: number; weights: Partial<Record<AiQualityCategory, number>>; sfxMaxPer10s: number; iterations: number }
): Promise<ScoreOutcome> {
  const deterministic = computeDeterministicScores({
    captions: ctx.captions,
    broll: ctx.broll,
    zoom: ctx.zoom,
    sceneRemoval: ctx.speech.sceneRemoval,
    music: ctx.music,
    sfx: ctx.sfx,
    varietyLedger: ctx.varietyLedger,
    sourceDurationMs: ctx.speech.sourceDurationMs,
    brollDensity: ctx.jobMeta.brollDensity,
    sfxMaxPer10s: opts.sfxMaxPer10s,
  });

  const story = ctx.story ?? { beats: [], hookText: "", retentionRisks: [] };
  const reviewReq: ReasoningQualityReviewRequest = {
    storySummary: { hookText: story.hookText, beats: story.beats, retentionScore: story.retentionScore ?? 50 },
    captions: ctx.captions,
    broll: ctx.broll,
    zoom: ctx.zoom,
    stickers: ctx.stickers,
    transitions: ctx.transitions,
    music: ctx.music,
    sfx: ctx.sfx,
    deterministicScores: {
      captions: deterministic.captionScore,
      broll: deterministic.brollScore,
      music: deterministic.musicScore,
      sfx: deterministic.sfxScore,
      zoom: deterministic.zoomScore,
      visualVariety: deterministic.visualVarietyScore,
      editingRhythm: deterministic.editingRhythmScore,
    },
    sourceDurationMs: ctx.speech.sourceDurationMs,
    repairMaxAttempts: ctx.jobMeta.repairMaxAttempts,
  };
  const reviewResult = await reviewQualityAgent(reviewReq, { userId: ctx.jobMeta.userId });

  const scores = buildQualityScoresV2(
    deterministic,
    {
      hookScore: reviewResult.hookScore,
      retentionScore: reviewResult.retentionScore,
      storyScore: reviewResult.storyScore,
      weakCategories: reviewResult.weakCategories,
    },
    opts.weights,
    opts.targetScore,
    opts.iterations
  );

  return { scores, costUsd: reviewResult.costUsd ?? 0, warnings: reviewResult.warnings ?? [] };
}

export interface RunDirectorPipelineInput {
  videoAnalysis: VideoAnalysisOutput;
  speech: SpeechAnalysisOutput;
  jobMeta: DirectorJobMeta;
  wantsModule: DirectorContext["wantsModule"];
}

// The Final Director gate (TASK — "would I deliver this edit?") is not a
// separate LLM roleplay call — it's this function's own termination
// check: overallScore >= targetScore finalizes; otherwise the bounded
// loop below keeps trying. If maxIterations is reached first, the
// BEST-SCORING attempt seen is kept and thresholdMet is stamped false —
// never silently pretends to have hit the bar it didn't hit.
export async function runDirectorPipeline(input: RunDirectorPipelineInput): Promise<DirectorPipelineResult> {
  const [targetScore, maxIterations, gapThresholdMs, weights, sfxMaxPer10s] = await Promise.all([
    getConfig("AI_EDIT_QUALITY_TARGET_SCORE"),
    getConfig("AI_EDIT_DIRECTOR_MAX_QUALITY_ITERATIONS"),
    getConfig("AI_EDIT_NO_DEAD_SCREEN_GAP_THRESHOLD_MS"),
    getConfig("AI_EDIT_QUALITY_CATEGORY_WEIGHTS"),
    getConfig("AI_EDIT_SFX_MAX_PER_10S"),
  ]);

  let ctx: DirectorContext = {
    videoAnalysis: input.videoAnalysis,
    speech: input.speech,
    jobMeta: input.jobMeta,
    wantsModule: input.wantsModule,
    story: undefined,
    captions: [],
    zoom: [],
    broll: [],
    stickers: [],
    transitions: [],
    music: undefined,
    sfx: [],
    varietyLedger: createEmptyVarietyLedger(),
    reasoningCostUsd: 0,
    warnings: [],
  };

  // First full pass — every agent runs once (module-selection no-ops
  // handled inside each runXAgent). A failure here is fatal to the
  // Director attempt (propagates to ai-edit-jobs.ts's own try/catch,
  // same as a legacy planTimeline() failure) — there's no partial result
  // worth keeping when even the first pass never completed.
  ctx = await runAgentsInOrder(ctx, ["story", "captions", "visuals", "audio"]);
  ctx = applyNoDeadScreenPass(ctx, gapThresholdMs);

  const firstScoreOutcome = await scoreDirectorPlan(ctx, { targetScore, weights, sfxMaxPer10s, iterations: 1 });
  ctx = {
    ...ctx,
    reasoningCostUsd: ctx.reasoningCostUsd + firstScoreOutcome.costUsd,
    warnings: firstScoreOutcome.warnings.length > 0 ? [...ctx.warnings, ...firstScoreOutcome.warnings] : ctx.warnings,
  };

  let scores = firstScoreOutcome.scores;
  const history: DirectorIterationEntry[] = [{ iteration: 1, agentsInvoked: ["story", "captions", "visuals", "audio", "review"], scores, timestamp: new Date().toISOString() }];
  let best = { ctx, scores };
  let iteration = 1;

  // Bounded, targeted quality-review loop — TASK "if any category scores
  // below the configured threshold, regenerate ONLY the weak module,
  // repeat until Overall Quality >= 90 or max iterations reached."
  while (scores.overallScore < targetScore && iteration < maxIterations && scores.weakCategoriesFinal.length > 0) {
    const agentsToRerun = resolveAgentsToRerun(scores.weakCategoriesFinal);
    const previousOverall = scores.overallScore;

    try {
      ctx = await runAgentsInOrder(ctx, agentsToRerun);
      ctx = applyNoDeadScreenPass(ctx, gapThresholdMs);
      iteration++;
      const outcome = await scoreDirectorPlan(ctx, { targetScore, weights, sfxMaxPer10s, iterations: iteration });
      ctx = {
        ...ctx,
        reasoningCostUsd: ctx.reasoningCostUsd + outcome.costUsd,
        warnings: outcome.warnings.length > 0 ? [...ctx.warnings, ...outcome.warnings] : ctx.warnings,
      };
      scores = outcome.scores;
    } catch {
      // A retry iteration failing is never fatal — the best attempt
      // already seen is still fully usable, same "keep the good result"
      // principle the legacy single bounded retry already follows.
      break;
    }

    history.push({ iteration, agentsInvoked: agentsToRerun, scores, timestamp: new Date().toISOString() });
    if (scores.overallScore > best.scores.overallScore) best = { ctx, scores };

    if (scores.overallScore <= previousOverall && countTrailingNonImproving(history) >= STAGNATION_ROUNDS) break;
  }
  if (scores.overallScore > best.scores.overallScore) best = { ctx, scores };

  const finalScores: AiQualityScoresV2 = { ...best.scores, thresholdMet: best.scores.overallScore >= targetScore, iterations: history.length };

  return {
    captions: best.ctx.captions,
    zoom: best.ctx.zoom,
    broll: best.ctx.broll,
    stickers: best.ctx.stickers,
    transitions: best.ctx.transitions,
    music: best.ctx.music,
    sfx: best.ctx.sfx,
    story: best.ctx.story ?? { beats: [], hookText: "", retentionRisks: [] },
    scores: finalScores,
    reasoningCostUsd: best.ctx.reasoningCostUsd,
    warnings: best.ctx.warnings,
    iterationHistory: history,
  };
}
