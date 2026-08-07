import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { resolveAbsoluteUrl } from "@/lib/providers/storage/absolute-url";
import { transcribeAudio } from "@/lib/generation/transcription";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { analyzeVideo } from "@/lib/generation/video-understanding";
import { planTimeline } from "@/lib/generation/reasoning";
import type { ReasoningPlanRequest } from "@/lib/providers/reasoning/types";
import type { VideoUnderstandingResultWithProvider } from "@/lib/providers/video-understanding";
import { resolveBrollItems } from "./ai-broll-resolver";
import { resolveTimelinePlanAssets } from "./ai-asset-resolver";
import { computeSurvivingSegments, normalizeSceneRemovalWindows } from "@/app/editor/[projectId]/ai-timeline-translator";
import type { ClipView } from "@/app/editor/types";
import { getConfig } from "@/lib/admin/config";
import { logger } from "@/lib/observability/logger";
import { consumeCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess, convertUsdToCredits } from "@/lib/credits/video-actions";
import { InvalidStateError } from "./errors";
import { getOwnedProject } from "./projects";
import { mergeSceneRemovalCandidates, proposeSceneRemovals } from "./ai-scene-removal-proposer";
import { scoreAiTimelinePlan, AI_EDIT_QUALITY_RETRY_THRESHOLD } from "./ai-edit-quality-scoring";
import {
  aiTimelinePlanSchema,
  AI_TIMELINE_SCHEMA_VERSION,
  AI_ZOOM_SOURCE_CLIP_PLACEHOLDER,
  type AIBroll,
  type AICaption,
  type AIIntake,
  type AISceneRemoval,
  type AITimelinePlan,
  type AITransitionPlan,
  type AIZoom,
  type AIMusic,
  type AISfx,
  type AISticker,
  type AICostSummary,
} from "@/lib/validations/ai-timeline";
import { AI_EDIT_MODULES, type AiEditModule } from "@/lib/validations/video-editor";

// Module 2's plan always reads the PROJECT's own current aspect ratio for
// intake.aspectRatio (below, in processAiEditJob) — this module only
// proposes scene removals, it never changes the project's aspect ratio,
// so there's no separate "chosen at intake" value to accept here. A
// future module that DOES let intake pick a different aspect ratio can
// add that as its own input then.

// Phase 12 Module 2 (AI Auto-Editor) — the first module where anything
// actually RUNS. Scope deliberately tight: transcription + the
// sceneRemoval section it feeds (silence/filler-word detection), not the
// full 9-section pipeline — reasoning (GPT-5.x) and every Timeline JSON
// section beyond sceneRemoval stay for later modules. Same real Postgres
// poll-queue pattern as Module 10's export queue (see
// ai-edit-queue-worker.ts's own doc comment for why this is a SEPARATE
// worker/poll-loop, not folded into the export one).
//
// Phase 12 Module 3 extended this pipeline with real Gemini video
// understanding (lib/generation/video-understanding.ts) — for VIDEO
// assets, flagged bad_take/duplicate_take/quality_issue segments are
// merged with Module 2's transcript-based silence/filler_word candidates
// (ai-scene-removal-proposer.ts's mergeSceneRemovalCandidates) into one
// sceneRemoval list.
//
// Phase 12 Module 4 added real GPT-5.x reasoning (lib/generation/
// reasoning.ts) that combines the transcript + Module 3's persisted
// videoAnalysis into the `captions` and `zoom` sections — reusing both,
// never re-calling AssemblyAI/Gemini.
//
// Phase 12 Module 5 extended that SAME reasoning call to also propose
// `broll` slots (TASK 3 in gpt5.provider.ts's prompt), and added the
// RESOLVING_ASSETS step (ai-broll-resolver.ts) that turns each proposal
// into a real EditorAsset via real stock search/materialize or real
// image/video generation — reusing this app's existing, already-
// production-live Generation Engine wrappers, not a new adapter.
// stickers/music/sfx/transitions remain out of scope for later modules;
// this module never re-decides sceneRemoval/captions/zoom either, only
// adds broll on top.

export interface CreateAiEditJobInput {
  projectId: string;
  userId: string;
  assetId: string;
  stylePreset?: string;
  // Founder request (2026-07-18) — see AI_BROLL_DENSITIES' own doc comment
  // (lib/validations/video-editor.ts).
  brollDensity?: string;
  // Founder policy (2026-07-18) — per-job override of the admin default
  // (AI_EDIT_BROLL_STOCK_ONLY). Undefined means "use whatever the admin
  // config says right now" — resolved below at creation time so the job
  // keeps a fixed, historical record of the policy that was active, per
  // AiEditJob.brollStockOnly's own doc comment.
  brollStockOnly?: boolean;
  // Founder policy follow-up (2026-07-23) — per-job override of the admin
  // default (AI_EDIT_BROLL_RELEVANCE_FALLBACK_THRESHOLD). Same "undefined
  // means use the current admin config" / "resolved once at creation time"
  // pattern as brollStockOnly above — see AiEditJob.brollRelevanceFallbackThreshold's
  // own doc comment.
  brollRelevanceFallbackThreshold?: number;
  // Phase 12 Module 8 — pasted reference text, "if provided." See
  // aiIntakeSchema.script's own doc comment for the full contract.
  script?: string;
  // Founder request (2026-07-30) — see AI_EDIT_MODULES' own doc comment.
  // Omitted/undefined means "every module" (unchanged pre-existing
  // behavior).
  selectedModules?: AiEditModule[];
}

export async function createAiEditJob(input: CreateAiEditJobInput) {
  await getOwnedProject(input.userId, input.projectId);
  const asset = await prisma.editorAsset.findFirst({ where: { id: input.assetId, userId: input.userId } });
  if (!asset) throw new InvalidStateError("Asset not found.");
  if (asset.kind !== "VIDEO" && asset.kind !== "AUDIO") {
    throw new InvalidStateError("The AI Auto-Editor needs a VIDEO or AUDIO asset to transcribe.");
  }

  // Fixed 2026-07-19 — precheck before the job is even queued, so an
  // obviously-insufficient balance/tier blocks before any real vendor call
  // fires (transcription is the pipeline's first one). Only a floor check
  // (VIDEO_ACTION_CREDIT_COSTS.ai_auto_edit's own doc comment) — the real
  // charge, computed from this run's actual cost, happens in
  // processAiEditJob() once that's known.
  await checkVideoActionAccess(input.userId, "ai_auto_edit");

  const brollStockOnly = input.brollStockOnly ?? (await getConfig("AI_EDIT_BROLL_STOCK_ONLY"));
  const brollRelevanceFallbackThreshold = input.brollRelevanceFallbackThreshold ?? (await getConfig("AI_EDIT_BROLL_RELEVANCE_FALLBACK_THRESHOLD"));

  return prisma.aiEditJob.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      sourceAssetId: input.assetId,
      stylePreset: input.stylePreset,
      brollStockOnly,
      brollRelevanceFallbackThreshold,
      brollDensity: input.brollDensity,
      script: input.script,
      selectedModules: input.selectedModules as unknown as never,
    },
  });
}

// Null/missing (job predates this field, or the caller omitted it) means
// "every module" — the exact behavior this pipeline always had before
// module selection existed.
function resolveSelectedModules(raw: unknown): AiEditModule[] {
  return Array.isArray(raw) ? (raw as AiEditModule[]) : [...AI_EDIT_MODULES];
}

// The 7 sections that all come back from the ONE planTimeline() reasoning
// call — see that call site's own comment for why this can't be split per
// module.
const TIMELINE_PLANNING_MODULES: AiEditModule[] = ["captions", "zoom", "broll", "stickers", "music", "sfx", "transitions"];

// Same compare-and-swap shape as exports.ts's claimNextExport() — see that
// function's own comment for the "single-instance worker process only"
// caveat this inherits unchanged.
export async function claimNextAiEditJob() {
  const candidate = await prisma.aiEditJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.aiEditJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "UPLOADING", startedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  return prisma.aiEditJob.findUnique({ where: { id: candidate.id } });
}

// Real bug fix (2026-07-24, found live during the codebase health check) —
// this used to be a plain, unconditional update, unlike failJob() right
// below it (which already excludes CANCELLED). A user cancelling a job
// that was already mid-flight would have their cancel silently
// overwritten by the very next progress checkpoint this same in-flight
// promise writes moments later — same "not in [CANCELLED]" guard as
// failJob(), so a cancel actually sticks once it lands.
async function setStatus(jobId: string, status: string, extra: Record<string, unknown> = {}) {
  await prisma.aiEditJob.updateMany({ where: { id: jobId, status: { notIn: ["CANCELLED"] } }, data: { status: status as never, ...extra } });
}

async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await prisma.aiEditJob.updateMany({
    where: { id: jobId, status: { notIn: ["CANCELLED"] } },
    data: { status: "FAILED", completedAt: new Date(), errorMessage },
  });
}

// Real bug fix (2026-07-24, found live during the codebase health check) —
// this pipeline had no way to cancel a job at all, unlike Export's own
// cancelExport() (exports.ts). Same "flag it, don't preempt in-flight
// work" convention Export already accepts (its own doc comment): unlike
// Export's frame loop, processAiEditJob() has no interruption points of
// its own to check a live flag between steps, so a cancel of an ACTIVELY
// RUNNING job stops it from ever reaching READY_FOR_REVIEW/consuming
// credits (setStatus/the final transaction below both now guard against
// CANCELLED) without literally killing the in-flight vendor calls — the
// same trade-off already accepted for asset-normalize-worker.ts's timed-
// out downloads. A QUEUED job is stopped outright (never claimed).
export async function cancelAiEditJob(projectId: string, userId: string, jobId: string): Promise<void> {
  const claimed = await prisma.aiEditJob.updateMany({
    where: {
      id: jobId,
      projectId,
      userId,
      status: { notIn: ["READY_FOR_REVIEW", "FAILED", "CANCELLED"] },
    },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new InvalidStateError("Only a queued or in-progress job can be cancelled.");
  }
}

// The actual pipeline this module builds: fetch the source asset -> real
// transcription call -> rule-based scene-removal proposal -> assemble a
// (mostly-empty, sceneRemoval-only) AITimelinePlan -> READY_FOR_REVIEW.
// Applying the plan to the live timeline happens CLIENT-SIDE (see
// ai-auto-edit-panel.tsx) via the EXACT SAME translateAITimelinePlan +
// runCommand path manual editing uses — this function only ever produces
// the PLAN, never touches EditorTrack/EditorClip rows itself, so the
// standing "every AI-driven edit goes through the Command pattern" rule
// is never at risk of a parallel mutation path sneaking in here.
// Real incident (2026-07-21) — a job's DB status read "READY" but
// AssemblyAI's own upload step (which does OUR server's fetch(audioUrl),
// not AssemblyAI's — see assemblyai.provider.ts's own header comment)
// still got a 404 fetching the source file. asset-normalize-worker.ts
// DOES await its storage.upload() before flipping the DB row to READY, so
// this isn't a simple ordering bug in this codebase's own control flow —
// but a defense-in-depth check here costs almost nothing and closes the
// gap regardless of the exact underlying cause (a non-atomic in-place
// overwrite, a slow disk flush, or anything else outside this function's
// visibility). A short bounded retry, not an immediate hard fail, since a
// transient "not quite there yet" is exactly the kind of thing a few
// seconds of backoff resolves; if it's still unreachable after that, the
// real error should surface honestly rather than retry forever.
async function waitUntilFetchable(url: string, attempts = 5, initialDelayMs = 500): Promise<void> {
  let delay = initialDelayMs;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return;
    } catch {
      // Network hiccup — treated the same as a non-OK status, retry below.
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new InvalidStateError(`Source asset's file isn't reachable yet at ${url} after ${attempts} attempts.`);
}

export async function processAiEditJob(jobId: string): Promise<void> {
  const job = await prisma.aiEditJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const selectedModules = resolveSelectedModules(job.selectedModules);
  const wantsModule = (m: AiEditModule) => selectedModules.includes(m);

  try {
    // Re-fetch project/asset fresh — this worker call is a separate
    // process tick from createAiEditJob, not trusting anything cached
    // from creation time.
    const project = await prisma.editorProject.findUnique({ where: { id: job.projectId } });
    if (!project) throw new InvalidStateError("Project no longer exists.");

    const asset = await prisma.editorAsset.findFirst({ where: { id: job.sourceAssetId, userId: job.userId } });
    if (!asset) throw new InvalidStateError("The source asset no longer exists.");
    if (asset.status !== "READY") throw new InvalidStateError(`Source asset isn't READY yet (status: ${asset.status}).`);

    // Phase 12 Module 7 — genuinely incremental progress, replacing the
    // old "0% for the whole job, then a single jump to 100%" behavior.
    // Checkpoints are approximate (this pipeline's stages don't have
    // equal real duration), just monotonic and truthful about which
    // stage is actually running — matching the same stages
    // STATUS_LABEL already surfaces in the review UI, so the label and
    // the number never contradict each other.
    await setStatus(jobId, "TRANSCRIBING", { progress: 15 });
    const storage = await getStorageProvider();
    const mediaUrl = resolveAbsoluteUrl(storage.getPublicUrl(asset.storageKey));
    await waitUntilFetchable(mediaUrl);
    const transcript = await transcribeAudio({ audioUrl: mediaUrl }, { userId: job.userId });

    // 2026-07-20 fix — a real incident: the legacy Film flow already
    // refuses to treat a MOCK_PROVIDER_ID result as real (isMockTranscript
    // banner), but this pipeline had no equivalent check, so captions/
    // scene-removal/reasoning could silently run on fake placeholder
    // sentences whenever every real TRANSCRIPTION provider was
    // disabled/unreachable, with the job still reporting COMPLETED. This
    // is a hard fail, not a warning, because unlike the Film flow's
    // scene-by-scene review screen, nothing downstream here re-checks the
    // transcript before committing captions/removals to the timeline.
    if (transcript.providerId === MOCK_PROVIDER_ID) {
      throw new InvalidStateError(
        "Transcription used the placeholder provider, not a real one — no TRANSCRIPTION provider (AssemblyAI/Whisper) is currently enabled and reachable. Check Admin → AI Providers, then try again."
      );
    }

    // Phase 12 Module 3 — Gemini "watching" the footage, ONLY for VIDEO
    // assets (an AUDIO-only upload has no visual content to analyze; Module
    // 2's existing dual-kind support stays transcript-only for those, same
    // as before this module). Failure here is deliberately non-fatal to the
    // whole job: video understanding is an ENHANCEMENT over Module 2's
    // already-working transcript-only removal proposals, not a hard
    // dependency — if Gemini errors out (quota, transient failure, an
    // unsupported file), the job still completes with the silence/
    // filler_word candidates Module 2 already produces, rather than losing
    // a working feature because a newer one hiccuped.
    let videoAnalysis: VideoUnderstandingResultWithProvider | null = null;
    if (asset.kind === "VIDEO") {
      await setStatus(jobId, "ANALYZING_VIDEO", { progress: 35 });
      try {
        videoAnalysis = await analyzeVideo({ videoUrl: mediaUrl }, { userId: job.userId });
      } catch (err) {
        logger.error({ err, jobId }, "[ai edit job] video understanding failed — continuing transcript-only");
      }
    }

    await setStatus(jobId, "PLANNING_REMOVALS", { progress: 45 });
    // Founder request (2026-07-30) — module selection. If "sceneRemoval"
    // wasn't selected, skip proposing it entirely rather than computing it
    // and discarding it — this step (unlike planTimeline below) is fully
    // independent, so it can be skipped outright with no shared call to
    // preserve.
    let sceneRemoval: AISceneRemoval[] = [];
    if (wantsModule("sceneRemoval")) {
      // Fix (2026-08-06, FIX 3) — proposeSceneRemovals now runs an ADAPTIVE
      // silence detector (per-gap threshold from local speech speed, see
      // ai-scene-removal-proposer.ts/lib/transcription/segmentation.ts's
      // own doc comments), not one flat cutoff. silenceThresholdMs is now
      // the adaptive pivot; the two new configs are the hard floor/ceiling
      // ("natural breathing pauses remain" / "long pauses always
      // removed") — all three admin-configurable, same "read at the
      // orchestration layer, passed down as a plain option" convention as
      // before.
      const [silenceThresholdMs, minThresholdMs, maxThresholdMs, referenceWpm] = await Promise.all([
        getConfig("AI_EDIT_SILENCE_THRESHOLD_MS"),
        getConfig("AI_EDIT_SILENCE_MIN_THRESHOLD_MS"),
        getConfig("AI_EDIT_SILENCE_MAX_THRESHOLD_MS"),
        getConfig("AI_EDIT_SILENCE_REFERENCE_WPM"),
      ]);
      const transcriptRemovals = proposeSceneRemovals(transcript.words, { silenceThresholdMs, minThresholdMs, maxThresholdMs, referenceWpm });
      const videoRemovals: AISceneRemoval[] = (videoAnalysis?.flaggedSegments ?? []).map((f) => ({
        startMs: f.startMs,
        endMs: f.endMs,
        reason: f.reason,
      }));
      sceneRemoval = mergeSceneRemovalCandidates([...transcriptRemovals, ...videoRemovals]);
    }

    // Phase 12 Module 6 — how many surviving segments sceneRemoval (just
    // decided, above) will produce, computed in SOURCE-relative time
    // (mirroring how sceneRemoval/captions/zoom/broll all already reason
    // in source-relative time, mapped to real timeline positions only at
    // apply time). Reuses the translator's own pure
    // computeSurvivingSegments/normalizeSceneRemovalWindows against a
    // NOMINAL clip spanning [0, sourceDurationMs) — legitimate reuse, not
    // a hack: that function's math only ever reads startMs/durationMs/
    // trimStartMs, never anything DB-specific, so a nominal stand-in
    // clip is exactly as valid as a real ClipView for this purpose. Fed
    // to the reasoning call so TASK 6 knows which segment-boundary
    // indices are actually valid to reference.
    const sourceDurationMs = Math.round((asset.durationSeconds ?? transcript.durationSeconds) * 1000);
    const nominalSourceClip = { startMs: 0, durationMs: sourceDurationMs, trimStartMs: 0 } as ClipView;
    const survivingSegmentCount = computeSurvivingSegments(
      nominalSourceClip,
      normalizeSceneRemovalWindows(sceneRemoval.map((r) => ({ startMs: r.startMs, endMs: r.endMs })))
    ).length;

    // Phase 12 Module 4 — GPT-5.x combining the transcript + Module 3's
    // persisted video-understanding output into captions + zoom. Reuses
    // BOTH without re-calling either vendor (transcript/videoAnalysis are
    // already in hand from the steps above). Non-fatal on failure, same
    // "enhancement over an already-working baseline" convention video
    // understanding established: sceneRemoval is a complete, valuable
    // result on its own — a captions/zoom planning failure shouldn't take
    // the whole job down with it. Unlike video understanding's SILENT
    // degrade, this failure IS surfaced (planningError), per the
    // founder's own "surface a clear 'planning failed' status rather
    // than silently applying malformed data" instruction — the
    // difference is what "surface" means: a job-killing FAILED status
    // would also discard the already-good sceneRemoval work, so this
    // surfaces at the field level instead, visible in the review UI.
    //
    // Fix (2026-08-06, FIX 2) — `planTimeline()` itself no longer throws
    // over a single invalid item (see parsePlanOutputLeniently, reasoning/
    // types.ts): a bad broll item no longer wipes out valid captions too.
    // `planResult.warnings` (set only when something was actually dropped
    // after every repair attempt) is surfaced into this SAME planningError
    // field below on the SUCCESS path, not just the catch block — the
    // field always meant "something about planning needs your attention,"
    // not strictly "planning threw," so a partial-degradation notice and a
    // total-failure notice share it rather than inventing a second field
    // (no breaking API/schema change).
    await setStatus(jobId, "PLANNING_TIMELINE", { progress: 55 });
    let captions: AICaption[] = [];
    let zoom: AIZoom[] = [];
    let brollProposals: AIBroll[] = [];
    let stickers: AISticker[] = [];
    let music: AIMusic | undefined;
    let sfx: AISfx[] = [];
    let transitions: AITransitionPlan[] = [];
    let planningError: string | null = null;
    let reasoningCostUsd = 0;
    // TASK 12 (2026-08-07, "quality scoring") — scored on the PROPOSED
    // (pre-resolution) plan, immediately after planTimeline() returns,
    // deliberately BEFORE broll resolution runs: resolution makes real
    // stock-search/materialize calls, so scoring first and only retrying
    // planTimeline() itself (never re-resolving broll twice) keeps the
    // bounded retry cheap. resolvedCount isn't known yet at this point, so
    // scoreAiTimelinePlan's visualScore uses the PROPOSED broll count as
    // its own resolution-count proxy here — a reasonable approximation
    // given stock resolution's real success rate, not the final, more
    // precise number computed after RESOLVING_ASSETS below.
    let attemptScores: ReturnType<typeof scoreAiTimelinePlan> | null = null;
    // Founder request (2026-07-30) — module selection. captions/zoom/broll/
    // stickers/music/sfx/transitions all come back from this ONE planTimeline()
    // call — there's no way to ask GPT for a subset, so the call itself only
    // runs at all if AT LEAST ONE of those 7 modules was selected; whichever
    // of its 7 output sections weren't selected are discarded immediately
    // below, before they ever reach asset resolution or the assembled plan.
    if (TIMELINE_PLANNING_MODULES.some(wantsModule)) {
      const repairMaxAttempts = await getConfig("AI_EDIT_REASONING_REPAIR_MAX_ATTEMPTS");
      const planRequest: ReasoningPlanRequest = {
        words: transcript.words,
        videoAnalysis: videoAnalysis
          ? { emphasisMoments: videoAnalysis.emphasisMoments, emotionBeats: videoAnalysis.emotionBeats, visualContext: videoAnalysis.visualContext }
          : null,
        stylePreset: job.stylePreset ?? undefined,
        brollDensity: (job.brollDensity as ReasoningPlanRequest["brollDensity"]) ?? undefined,
        brollStockOnly: job.brollStockOnly,
        referenceScript: job.script ?? undefined,
        sourceDurationMs,
        survivingSegmentCount,
        repairMaxAttempts,
      };

      // Re-bound to plain consts — TypeScript's control-flow narrowing
      // from processAiEditJob's own `if (!job) return;` guard doesn't
      // propagate into the nested attemptPlanning function declaration
      // below (a closure over a differently-scoped outer binding), same
      // "fight the narrowing with an explicit rebind" pattern already
      // used in ai-broll-resolver.ts's resolveStockBroll.
      const jobUserId = job.userId;
      const jobBrollDensity = job.brollDensity as "MINIMAL" | "BALANCED" | "HEAVY" | undefined;

      // One planning attempt -> the module-filtered sections + this
      // attempt's own quality scores, or null on a hard failure (network/
      // auth/unrecoverable JSON — see planTimeline's own error contract).
      // Extracted so the bounded retry below can call it a second time
      // without duplicating the module-filtering logic.
      async function attemptPlanning() {
        const planResult = await planTimeline(planRequest, { userId: jobUserId });
        const attemptCaptions = wantsModule("captions") ? planResult.captions : [];
        // zoom comes back clipId-less (see AI_ZOOM_SOURCE_CLIP_PLACEHOLDER's
        // own doc comment) — the real clip id is only known client-side, at
        // apply time (ai-auto-edit-panel.tsx), same as sceneRemoval's own
        // source-relative-until-apply convention. transitions similarly
        // come back with segment-boundary placeholders where GPT used them
        // (AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX) — resolved client-side
        // too, inside the translator itself this time (no apply-time panel
        // remap needed, unlike zoom/broll — see mapTransitionsToSegmentBoundaries).
        const attemptZoom = wantsModule("zoom") ? planResult.zoom.map((z) => ({ ...z, clipId: AI_ZOOM_SOURCE_CLIP_PLACEHOLDER })) : [];
        const attemptBroll = wantsModule("broll") ? planResult.broll : [];
        const attemptStickers = wantsModule("stickers") ? (planResult.stickers ?? []) : [];
        const attemptMusic = wantsModule("music") ? planResult.music : undefined;
        const attemptSfx = wantsModule("sfx") ? (planResult.sfx ?? []) : [];
        const attemptTransitions = wantsModule("transitions") ? (planResult.transitions ?? []) : [];
        const scores = scoreAiTimelinePlan(
          { sceneRemoval, captions: attemptCaptions, zoom: attemptZoom, broll: attemptBroll, stickers: attemptStickers },
          {
            sourceDurationMs,
            brollDensity: jobBrollDensity,
            captionsInScope: wantsModule("captions"),
            visualInScope: wantsModule("broll") || wantsModule("zoom") || wantsModule("stickers"),
            pacingInScope: wantsModule("sceneRemoval") || wantsModule("captions"),
          }
        );
        return {
          captions: attemptCaptions,
          zoom: attemptZoom,
          brollProposals: attemptBroll,
          stickers: attemptStickers,
          music: attemptMusic,
          sfx: attemptSfx,
          transitions: attemptTransitions,
          reasoningCostUsd: planResult.costUsd ?? 0,
          warnings: planResult.warnings,
          scores,
        };
      }

      try {
        let best = await attemptPlanning();
        // Bounded single retry — "if score is poor, automatically
        // regenerate... never regenerate the whole edit": this re-runs
        // ONLY the reasoning call (never transcription/scene-removal/
        // broll resolution), and only ONCE, keeping whichever of the two
        // attempts scored higher — never a loop, never unbounded vendor
        // spend. Legacy single-call path only, deliberately left
        // byte-identical to its pre-Director-pipeline behavior (still the
        // plain AI_EDIT_QUALITY_RETRY_THRESHOLD=55 const, NOT the new
        // AI_EDIT_QUALITY_TARGET_SCORE=90 config) — the two thresholds
        // score fundamentally different rubrics (this one a coarse
        // 4-dimension average, the Director's a 10-category weighted
        // score) and are not interchangeable. The AI Video Director
        // pipeline (AI_EDIT_DIRECTOR_PIPELINE_ENABLED) has its own,
        // separately-configured iterative loop (director/orchestrator.ts)
        // that reads AI_EDIT_QUALITY_TARGET_SCORE instead.
        if (best.scores.editingScore < AI_EDIT_QUALITY_RETRY_THRESHOLD) {
          logger.info({ jobId, scores: best.scores }, "[ai edit job] first planning attempt scored below the quality threshold — retrying once");
          try {
            const retry = await attemptPlanning();
            if (retry.scores.editingScore > best.scores.editingScore) best = retry;
          } catch (retryErr) {
            // The retry failing is never fatal — the FIRST attempt already
            // succeeded and is still fully usable, just lower-scoring.
            logger.warn({ err: retryErr, jobId }, "[ai edit job] quality-triggered planning retry failed — keeping the first (already-valid) attempt");
          }
        }

        captions = best.captions;
        zoom = best.zoom;
        brollProposals = best.brollProposals;
        stickers = best.stickers;
        music = best.music;
        sfx = best.sfx;
        transitions = best.transitions;
        reasoningCostUsd = best.reasoningCostUsd;
        attemptScores = best.scores;
        if (best.warnings && best.warnings.length > 0) {
          planningError = `Some items in the AI's plan were invalid and were skipped, everything else still applied: ${best.warnings.join(" ")}`;
          logger.warn({ jobId, warnings: best.warnings }, "[ai edit job] timeline planning partially degraded — some items dropped, continuing with the rest");
        }
      } catch (err) {
        planningError = err instanceof Error ? err.message : "Timeline planning (captions/zoom/broll/stickers/music/sfx/transitions) failed.";
        logger.error({ err, jobId }, "[ai edit job] timeline planning failed — continuing with sceneRemoval only");
      }
    }

    // Phase 12 Module 5/6 — resolve every proposed asset-needing slot
    // (broll, stickers, music, sfx) into real EditorAssets: real stock
    // search+materialize (ai-asset-resolver.ts/ai-broll-resolver.ts), or
    // for broll's "generate" source, real image/video generation reusing
    // this app's existing production Generation Engine wrappers. Broll
    // and stickers/music/sfx resolve in PARALLEL (genuinely independent
    // of each other — different tracks, different vendor calls). Every
    // ITEM within each also resolves independently — never fatal to this
    // step or the job as a whole; an item that couldn't resolve keeps
    // its resolutionNote and simply has no resolvedAssetId/assetId,
    // which the translator already treats as an explicit "needs
    // resolution" marker (Module 1), never a silent drop.
    let broll: AIBroll[] = [];
    let resolvedStickers: AISticker[] = [];
    let resolvedMusic: AIMusic | undefined;
    let resolvedSfx: AISfx[] = [];
    if (brollProposals.length > 0 || stickers.length > 0 || sfx.length > 0 || music) {
      await setStatus(jobId, "RESOLVING_ASSETS", { progress: 75 });
      const resolutionCtx = {
        userId: job.userId,
        aspectRatio: project.aspectRatio as AIIntake["aspectRatio"],
        stockOnly: job.brollStockOnly,
        relevanceFallbackThreshold: job.brollRelevanceFallbackThreshold,
      };
      const [resolvedAssets, resolvedBroll] = await Promise.all([
        resolveTimelinePlanAssets({ stickers, music, sfx }, resolutionCtx),
        brollProposals.length > 0 ? resolveBrollItems(brollProposals, resolutionCtx) : Promise.resolve([]),
      ]);
      resolvedStickers = resolvedAssets.stickers;
      resolvedMusic = resolvedAssets.music;
      resolvedSfx = resolvedAssets.sfx;
      broll = resolvedBroll;
    }

    await setStatus(jobId, "BUILDING_TIMELINE", { progress: 90 });

    // Phase 12 Module 10 — a snapshot of what THIS run's real provider
    // calls actually cost, summed from the costUsd numbers already
    // attached by the Generation Engine to each step's own result
    // (transcript/videoAnalysis/planResult) plus each resolved broll
    // item's own costUsd (0 for stock, real generation cost otherwise —
    // stickers/music/sfx never call a paid generation provider, only
    // stock/curated search, so they're excluded here rather than added
    // as always-zero noise).
    const transcriptionUsd = transcript.costUsd ?? 0;
    const videoUnderstandingUsd = videoAnalysis?.costUsd ?? 0;
    const brollGenerationUsd = broll.reduce((sum, item) => sum + (item.costUsd ?? 0), 0);
    const cost: AICostSummary = {
      transcriptionUsd,
      videoUnderstandingUsd,
      reasoningUsd: reasoningCostUsd,
      brollGenerationUsd,
      totalUsd: transcriptionUsd + videoUnderstandingUsd + reasoningCostUsd + brollGenerationUsd,
    };

    const plan: AITimelinePlan = {
      version: AI_TIMELINE_SCHEMA_VERSION,
      intake: {
        aspectRatio: project.aspectRatio as AIIntake["aspectRatio"],
        stylePreset: job.stylePreset ?? undefined,
        brollDensity: (job.brollDensity as AIIntake["brollDensity"]) ?? undefined,
        brollStockOnly: job.brollStockOnly,
        script: job.script ?? undefined,
      },
      sceneRemoval,
      captions,
      zoom,
      broll,
      stickers: resolvedStickers,
      music: resolvedMusic,
      sfx: resolvedSfx,
      transitions,
      cost,
      // TASK 12 — computed pre-resolution (see attemptPlanning above),
      // absent when the reasoning call never ran at all (e.g. no TIMELINE_
      // PLANNING_MODULES selected) — same "absent means not computed,
      // never a fabricated retrofit" convention as `cost`.
      qualityScores: attemptScores ?? undefined,
    };
    // Defense in depth: every piece (sceneRemoval/captions/zoom) was
    // already validated at its own source (mergeSceneRemovalCandidates'
    // inputs come from schema-typed proposers; captions/zoom came back
    // through reasoningPlanOutputSchema inside the adapter itself) — this
    // final parse only catches an assembly-level mistake in THIS
    // function, never a vendor's malformed output (that's already been
    // rejected upstream). A throw here is a real bug, not an AI-output
    // problem, so it's allowed to fail the whole job via the outer catch.
    const validatedPlan = aiTimelinePlanSchema.parse(plan);

    // Fixed 2026-07-19 — charge-after-success, same convention as every
    // other real-generation path in this codebase (generateVeoLiteVideo(),
    // renderTalkingHeadScene(), generateFilmSceneVideo()): the job's own
    // real, just-computed cost.totalUsd converts to credits via
    // convertUsdToCredits() (not the fixed precheck floor from
    // createAiEditJob — that was only ever a rough "did you have anything"
    // gate). consumeCredits() re-validates the balance atomically here
    // regardless of the earlier precheck, same as everywhere else.
    const usdToInrRate = await getConfig("USD_TO_INR_RATE");
    const creditsToCharge = convertUsdToCredits(cost.totalUsd, usdToInrRate);

    await prisma.$transaction(async (tx) => {
      // Real bug fix (2026-07-24, found live during the codebase health
      // check) — a job cancelled while this promise was still mid-flight
      // (see cancelAiEditJob()) used to have NOTHING stopping this final
      // step from blindly overwriting it back to READY_FOR_REVIEW and, far
      // worse, actually charging real credits for a run the user already
      // cancelled. Re-checked atomically, inside the SAME transaction as
      // the charge, right before consumeCredits() runs — not a plain read
      // beforehand, which would leave the identical race open one line
      // earlier.
      const current = await tx.aiEditJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
      if (current.status === "CANCELLED") return;

      if (creditsToCharge > 0) {
        await consumeCredits(
          {
            userId: job.userId,
            amount: creditsToCharge,
            type: "AI_GENERATION",
            description: `AI Auto-Editor (job ${jobId})`,
          },
          tx
        );
      }
      await tx.aiEditJob.update({
        where: { id: jobId },
        data: {
          status: "READY_FOR_REVIEW",
          progress: 100,
          completedAt: new Date(),
          transcript: transcript as unknown as never,
          videoAnalysis: videoAnalysis
            ? ({ ...videoAnalysis, durationSeconds: asset.durationSeconds ?? transcript.durationSeconds } as unknown as never)
            : undefined,
          timelinePlan: validatedPlan as unknown as never,
          planningError,
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI Auto-Edit job failed.";
    logger.error({ err, jobId }, "[ai edit job] processing failed");
    await failJob(jobId, message);
  }
}

export async function listAiEditJobs(projectId: string, userId: string) {
  await getOwnedProject(userId, projectId);
  return prisma.aiEditJob.findMany({ where: { projectId, userId }, orderBy: { createdAt: "desc" } });
}
