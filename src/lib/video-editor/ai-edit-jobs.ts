import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { resolveAbsoluteUrl } from "@/lib/providers/storage/absolute-url";
import { transcribeAudio } from "@/lib/generation/transcription";
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
  // Phase 12 Module 8 — pasted reference text, "if provided." See
  // aiIntakeSchema.script's own doc comment for the full contract.
  script?: string;
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

  return prisma.aiEditJob.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      sourceAssetId: input.assetId,
      stylePreset: input.stylePreset,
      brollStockOnly,
      brollDensity: input.brollDensity,
      script: input.script,
    },
  });
}

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

async function setStatus(jobId: string, status: string, extra: Record<string, unknown> = {}) {
  await prisma.aiEditJob.update({ where: { id: jobId }, data: { status: status as never, ...extra } });
}

async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await prisma.aiEditJob.updateMany({
    where: { id: jobId, status: { notIn: ["CANCELLED"] } },
    data: { status: "FAILED", completedAt: new Date(), errorMessage },
  });
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
export async function processAiEditJob(jobId: string): Promise<void> {
  const job = await prisma.aiEditJob.findUnique({ where: { id: jobId } });
  if (!job) return;

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
    const transcript = await transcribeAudio({ audioUrl: mediaUrl }, { userId: job.userId });

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
    const silenceThresholdMs = await getConfig("AI_EDIT_SILENCE_THRESHOLD_MS");
    const transcriptRemovals = proposeSceneRemovals(transcript.words, { silenceThresholdMs });
    const videoRemovals: AISceneRemoval[] = (videoAnalysis?.flaggedSegments ?? []).map((f) => ({
      startMs: f.startMs,
      endMs: f.endMs,
      reason: f.reason,
    }));
    const sceneRemoval = mergeSceneRemovalCandidates([...transcriptRemovals, ...videoRemovals]);

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
    try {
      const repairMaxAttempts = await getConfig("AI_EDIT_REASONING_REPAIR_MAX_ATTEMPTS");
      const planResult = await planTimeline(
        {
          words: transcript.words,
          videoAnalysis: videoAnalysis
            ? {
                emphasisMoments: videoAnalysis.emphasisMoments,
                emotionBeats: videoAnalysis.emotionBeats,
                visualContext: videoAnalysis.visualContext,
              }
            : null,
          stylePreset: job.stylePreset ?? undefined,
          brollDensity: (job.brollDensity as ReasoningPlanRequest["brollDensity"]) ?? undefined,
          brollStockOnly: job.brollStockOnly,
          referenceScript: job.script ?? undefined,
          sourceDurationMs,
          survivingSegmentCount,
          repairMaxAttempts,
        },
        { userId: job.userId }
      );
      captions = planResult.captions;
      // zoom comes back clipId-less (see AI_ZOOM_SOURCE_CLIP_PLACEHOLDER's
      // own doc comment) — the real clip id is only known client-side, at
      // apply time (ai-auto-edit-panel.tsx), same as sceneRemoval's own
      // source-relative-until-apply convention. transitions similarly
      // come back with segment-boundary placeholders where GPT used them
      // (AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX) — resolved client-side
      // too, inside the translator itself this time (no apply-time panel
      // remap needed, unlike zoom/broll — see mapTransitionsToSegmentBoundaries).
      zoom = planResult.zoom.map((z) => ({ ...z, clipId: AI_ZOOM_SOURCE_CLIP_PLACEHOLDER }));
      brollProposals = planResult.broll;
      stickers = planResult.stickers ?? [];
      music = planResult.music;
      sfx = planResult.sfx ?? [];
      transitions = planResult.transitions ?? [];
      reasoningCostUsd = planResult.costUsd ?? 0;
    } catch (err) {
      planningError = err instanceof Error ? err.message : "Timeline planning (captions/zoom/broll/stickers/music/sfx/transitions) failed.";
      logger.error({ err, jobId }, "[ai edit job] timeline planning failed — continuing with sceneRemoval only");
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
      const resolutionCtx = { userId: job.userId, aspectRatio: project.aspectRatio as AIIntake["aspectRatio"], stockOnly: job.brollStockOnly };
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
