import type { Prisma, RenderJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getStorageProvider, type StorageProvider } from "@/lib/providers/storage";
import { resolveAbsoluteUrl } from "@/lib/providers/storage/absolute-url";
import {
  composeTimeline,
  generateImage,
  generateVoiceover,
  generateVoiceoverOrDegrade,
  MOCK_PROVIDER_ID,
  renderVideo,
  transcribeAudio,
} from "@/lib/generation";
import type { TimelineClipInput } from "@/lib/providers/video";
import { buildSceneSubtitleVtt } from "@/lib/scenes/subtitle";
import { mergeScenesViaEditor } from "@/lib/scenes/merge-via-editor";
import { claimNextJob, completeJob, enqueueJob, failJob } from "@/lib/queue/queue";
import { recordAsset } from "@/lib/assets/service";
import { recordProjectVersion } from "@/lib/projects/versioning";
import { detectSilenceGaps, assignParagraphIndices, wordsWithinSegment } from "@/lib/transcription/segmentation";
import {
  chunkSegments,
  runContextAnalysisBatch,
  CONTEXT_ANALYSIS_BATCH_SIZE,
  type SegmentAnalysis,
} from "@/lib/talking-head/context-analysis";
import {
  runVisualPlanningBatch,
  groupSegmentsIntoScenes,
  type VisualPlanInput,
} from "@/lib/talking-head/visual-planner";
import { resolveSceneAsset } from "@/lib/talking-head/asset-selector";
import { applyAutomaticEditingPlan } from "@/lib/talking-head/timeline-plan";
import { consumeCredits, getCreditBalance, InsufficientCreditsError, refundCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess, resolveVideoProviderCredits } from "@/lib/credits/video-actions";
import type { SceneVisualType } from "@/generated/prisma/client";
import { notifyUser } from "@/lib/notifications/engine";

// Render Queue domain logic — lib/queue/* stays generic job-claim mechanics;
// this module is where scene/merge-specific rendering happens. Both kinds of
// RenderJob (scene: sceneId set, merge: sceneId null) flow through the SAME
// claim/complete/fail functions, distinguished only by dispatch here, so
// queue mechanics are never duplicated between the two job kinds.

export class InvalidStateError extends Error {}

// Runs N concurrent claim-and-process loops against the same atomically-safe
// claimNextJob() — real parallel rendering, not sequential draining. Safe at
// any concurrency because claiming is a conditional UPDATE (see queue.ts).
export async function drainQueue(concurrency: number): Promise<{ processedCount: number }> {
  let processedCount = 0;
  let exhausted = false;

  async function worker() {
    while (!exhausted) {
      const result = await processNextJob();
      if (!result.processed) {
        exhausted = true;
        return;
      }
      processedCount++;
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return { processedCount };
}

async function processNextJob(): Promise<{ processed: boolean; jobId?: string }> {
  const job = await claimNextJob();
  if (!job) return { processed: false };

  // Milestone 9 — Export and "Regenerate voice" are new RenderJob kinds
  // flowing through this SAME queue, distinguished by payload.kind. Existing
  // scene/merge jobs have payload: {} (kind undefined), so this check is
  // additive and falls through to the original behavior unchanged.
  const kind = (job.payload as Record<string, unknown> | null)?.kind;
  if (kind === "export") {
    await processExportJob(job);
  } else if (kind === "regen_voice") {
    await processRegenVoiceJob(job);
  } else if (kind === "transcribe") {
    await processTranscribeJob(job);
  } else if (kind === "analyze") {
    await processAnalyzeJob(job);
  } else if (job.sceneId) {
    await processSceneRenderJob(job);
  } else {
    await processMergeJob(job);
  }
  return { processed: true, jobId: job.id };
}

// Once every scene in a project is COMPLETED, queue a single merge job.
// `mergeQueued` is the atomic race-guard: many scenes can finish within
// milliseconds of each other (parallel rendering), but only the one
// `updateMany` that actually flips false -> true wins the right to enqueue.
async function tryFinalizeProject(videoProjectId: string): Promise<void> {
  const scenes = await prisma.scene.findMany({ where: { videoProjectId } });
  if (scenes.length === 0) return;

  const allCompleted = scenes.every((s) => s.status === "COMPLETED");
  const anyFailed = scenes.some((s) => s.status === "FAILED");
  const anyInFlight = scenes.some((s) => s.status === "PENDING" || s.status === "RENDERING");

  if (allCompleted) {
    const claimed = await prisma.videoProject.updateMany({
      where: { id: videoProjectId, mergeQueued: false, status: { notIn: ["CANCELLED"] } },
      data: { mergeQueued: true },
    });
    if (claimed.count !== 1) return;

    const project = await prisma.videoProject.findUniqueOrThrow({ where: { id: videoProjectId } });

    // Milestone 11 — a Talking Head project has no per-scene rendered video
    // to concatenate (every scene shares one base video, trimmed via the
    // Timeline, not a merge job); it finalizes straight to COMPLETED, with
    // the automatic editing plan (overlay clips) applied on top of the
    // already-seeded base layer. A real master (baked, no live overlays) is
    // produced by the EXISTING Export system whenever the user exports —
    // unchanged for either flow.
    if (project.sourceType === "TALKING_HEAD_UPLOAD") {
      await finalizeTalkingHeadProject(project);
      return;
    }

    const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");
    await enqueueJob({ videoProjectId, maxAttempts });
    return;
  }

  if (anyFailed && !anyInFlight) {
    await prisma.videoProject.updateMany({
      where: { id: videoProjectId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      data: { status: "FAILED", errorMessage: "One or more scenes failed to render." },
    });
  }
}

async function finalizeTalkingHeadProject(project: { id: string; userId: string; title: string; sourceAssetId: string | null }): Promise<void> {
  const sourceAsset = await prisma.asset.findUniqueOrThrow({ where: { id: project.sourceAssetId! } });
  const storage = await getStorageProvider();

  await applyAutomaticEditingPlan(project.id);

  const updated = await prisma.videoProject.updateMany({
    where: { id: project.id, status: { notIn: ["CANCELLED"] } },
    data: {
      status: "COMPLETED",
      previewVideoUrl: storage.getPublicUrl(sourceAsset.storageKey),
      masterVideoUrl: sourceAsset.storageKey,
      durationSeconds: sourceAsset.durationSeconds ? Math.round(sourceAsset.durationSeconds) : null,
      errorMessage: null,
    },
  });

  if (updated.count > 0) {
    void notifyUser({
      userId: project.userId,
      type: "RENDER_COMPLETE",
      title: "Your video is ready",
      body: `"${project.title}" finished rendering and is ready to preview.`,
      link: `/videos/${project.id}`,
    }).catch(() => undefined);
  }
}

async function processSceneRenderJob(job: RenderJob): Promise<void> {
  const scene = await prisma.scene.findUniqueOrThrow({
    where: { id: job.sceneId! },
    include: { videoProject: { include: { template: true } } },
  });
  const project = scene.videoProject;

  await prisma.$transaction([
    prisma.videoProject.updateMany({
      where: { id: project.id, status: { in: ["QUEUED", "PAUSED"] } },
      data: { status: "RENDERING" },
    }),
    prisma.scene.updateMany({
      where: { id: scene.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "RENDERING" },
    }),
  ]);

  // Charge-before-generation (2026-07-24) — how many credits were actually
  // reserved for THIS scene, if any; the catch block below only refunds
  // when this is non-zero (every earlier failure path — Talking Head
  // scenes, the voiceover mock-fallback throw — never reserves anything,
  // so there's nothing to refund there).
  let creditsReserved = 0;

  try {
    const storage = await getStorageProvider();
    const context = { videoProjectId: project.id, userId: project.userId, sceneId: scene.id };

    // Milestone 11 — Talking Head scenes never go through the GENERATED
    // flow's voice/video/image generation below: their visual is either the
    // original face-cam footage as-is (FACE_ONLY), or one overlay asset the
    // Intelligent Asset Selector resolved (Part 5) — reused for free
    // wherever possible, generated only as a last resort (Part 11).
    if (scene.visualType !== null) {
      await renderTalkingHeadScene(job, scene, project, storage, context);
      await tryFinalizeProject(project.id);
      return;
    }

    let voiceKey: string | undefined;
    let durationSeconds = scene.durationSeconds;
    // Real policy change (2026-07-25) — a voice failure (or a chain that
    // could only reach the mock placeholder) used to throw here and fail
    // the whole scene. generateVoiceoverOrDegrade() never throws for a
    // voice problem: it degrades to voice:null + a human-readable reason
    // instead, so the scene still completes with real video/image (this
    // function's own MOCK_PROVIDER_ID guard below still applies to those
    // independently) rather than being blocked entirely just because
    // narration alone failed. What's unchanged: a mock/placeholder result
    // is still never accepted as real narration — generateVoiceoverOrDegrade
    // enforces that itself, same standard the 2026-07-23 audit established.
    if (project.template?.includeVoiceover) {
      const voiceOutcome = await generateVoiceoverOrDegrade(
        {
          script: scene.prompt,
          contentLanguage: project.contentLanguage as never,
          voiceId: scene.voiceId ?? undefined,
        },
        context
      );
      if (voiceOutcome.voice) {
        const voiceObj = await storage.uploadFromUrl({
          key: `scenes/${scene.id}/voice.mp3`,
          sourceUrl: voiceOutcome.voice.audioUrl,
          contentType: "audio/mpeg",
        });
        voiceKey = voiceObj.key;
        durationSeconds = voiceOutcome.voice.durationSeconds;
        await recordAsset({ userId: project.userId, kind: "VOICE", storageKey: voiceKey, videoProjectId: project.id, sceneId: scene.id });
      } else {
        console.warn(
          `[render-pipeline] scene ${scene.id}: proceeding without narration — ${voiceOutcome.narrationSkippedReason}`
        );
      }
    }

    const finalQuality = await getConfig("FINAL_QUALITY");

    // AI Video reconciliation Step 2 — the credit-model switch: this used
    // to be free/unlimited at generation time (Milestone 4's original
    // design — "rendering itself is free and unlimited... only downloading
    // the finished master costs credits"), which made sense when this path
    // could only ever produce a mock placeholder or eventually a real but
    // unpriced vendor call. Now that scene generation can be genuinely real
    // Veo, the vendor cost is spent the moment this call succeeds
    // regardless of whether the user ever downloads — so it's charged here,
    // reusing the exact veo_lite precheck-then-charge-after-success
    // convention generateVeoLiteVideo() (System B) already proved, not a
    // new credit mechanism. Precheck runs BEFORE the real render call so an
    // insufficient balance/tier blocks the scene before any vendor cost is
    // spent, same reasoning as every other precheck in this codebase.
    const { credits: veoLiteCredits } = await checkVideoActionAccess(project.userId, "veo_lite");

    // Charge-before-generation (2026-07-24) — reserved here, before either
    // real vendor call, refunded in the catch block on any failure, true-up
    // settled against the real final cost on success. Same pattern as
    // generateVeoLiteVideo()/generateFilmSceneVideo() — see their comments.
    if (veoLiteCredits > 0) {
      await consumeCredits({ userId: project.userId, amount: veoLiteCredits, type: "AI_GENERATION", description: `Veo 3.1 Lite scene (${scene.id})`, videoProjectId: project.id });
      creditsReserved = veoLiteCredits;
    }

    // Each scene renders ONCE at final quality, no watermark — the merge
    // step (not here) is what produces both a watermarked preview and a
    // clean master, so vendor cost is paid once per scene, not twice.
    const [videoResult, imageResult] = await Promise.all([
      renderVideo(
        {
          script: scene.videoPrompt ?? scene.prompt,
          negativePrompt: scene.negativePrompt ?? undefined,
          aspectRatio: project.aspectRatio as never,
          durationSeconds,
          quality: finalQuality,
        },
        "scene_render",
        context,
        project.preferredVideoProviderId ?? undefined
      ),
      generateImage(
        {
          prompt: scene.imagePrompt ?? scene.prompt,
          negativePrompt: scene.negativePrompt ?? undefined,
          aspectRatio: project.aspectRatio as never,
        },
        "scene_image",
        context
      ),
    ]);

    // Real incident (2026-07-23) — a scene whose real Veo call failed used
    // to silently fall through to MOCK_PROVIDER_ID and still get marked
    // COMPLETED (only the credit charge was skipped, via the isMockFallback
    // check this replaces) — the project could reach a normal-looking
    // COMPLETED status with a fake stock placeholder clip standing in for
    // the user's real video, with zero indication anything was wrong.
    // Confirmed live: 10 of 16 real GENERATED projects in production hit
    // exactly this. Same standard already enforced for AI Auto-Edit's
    // transcription step (ai-edit-jobs.ts's own MOCK_PROVIDER_ID hard-fail)
    // — nothing downstream here re-checks the video before the user
    // downloads it as their final result, so a mock result must never be
    // silently treated as a real success. Thrown BEFORE uploading/
    // persisting the mock video/image (no point keeping a placeholder
    // asset we're about to declare invalid) — flows through the existing
    // catch block below exactly like any other real render failure,
    // reusing its already-built retry/fail semantics rather than a new
    // path.
    if (videoResult.providerId === MOCK_PROVIDER_ID) {
      throw new Error(
        "Scene render used the placeholder provider, not a real one — no VIDEO provider (Veo) is currently enabled and reachable. Check Admin → AI Providers, then try again."
      );
    }
    // Fixed (2026-07-24) — imageResult was never checked here, unlike
    // videoResult right above (that check's own old comment even said so
    // explicitly: "Only checks videoResult... which was also video-only").
    // This scene's thumbnail/overlay image could silently be
    // MockImageProvider's placeholder while the scene still completed
    // normally — found during a broader audit of every generateImage()
    // call site prompted by a direct question about whether the IMAGE
    // mock-fallback fix (originally built for Marketing Templates) covers
    // every pipeline that shares this function. It didn't, until now.
    if (imageResult.providerId === MOCK_PROVIDER_ID) {
      throw new Error(
        "Scene image used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable. Check Admin → AI Providers, then try again."
      );
    }

    const [videoObj, imageObj] = await Promise.all([
      storage.uploadFromUrl({ key: `scenes/${scene.id}/video.mp4`, sourceUrl: videoResult.videoUrl, contentType: "video/mp4" }),
      storage.uploadFromUrl({ key: `scenes/${scene.id}/image.jpg`, sourceUrl: imageResult.imageUrl, contentType: "image/jpeg" }),
    ]);
    await Promise.all([
      recordAsset({ userId: project.userId, kind: "VIDEO", storageKey: videoObj.key, videoProjectId: project.id, sceneId: scene.id }),
      recordAsset({ userId: project.userId, kind: "IMAGE", storageKey: imageObj.key, videoProjectId: project.id, sceneId: scene.id }),
    ]);

    const subtitleObj = await storage.upload({
      key: `scenes/${scene.id}/subtitle.vtt`,
      data: Buffer.from(buildSceneSubtitleVtt(scene.subtitleText ?? scene.prompt, durationSeconds), "utf-8"),
      contentType: "text/vtt",
    });

    // Charged for whichever provider actually rendered this scene
    // (videoResult.providerId), not necessarily project.preferredVideoProviderId
    // — if the user's chosen provider was unavailable and the chain fell
    // back to a different real provider, the charge reflects what actually
    // ran, never the one they picked but didn't get.
    const sceneCredits = await resolveVideoProviderCredits(veoLiteCredits, videoResult.providerId);

    await prisma.$transaction(async (tx) => {
      await tx.scene.update({
        where: { id: scene.id },
        data: {
          status: "COMPLETED",
          videoKey: videoObj.key,
          imageKey: imageObj.key,
          voiceKey,
          subtitleKey: subtitleObj.key,
          durationSeconds,
          errorMessage: null,
        },
      });
      await completeJob(job.id, { videoKey: videoObj.key, imageKey: imageObj.key }, tx);
    });

    // True-up the reservation against the real final cost — only reached on
    // full success (a mock/placeholder result throws above and never gets
    // here). Mirrors generateVeoLiteVideo()'s identical true-up.
    if (sceneCredits < creditsReserved) {
      await refundCredits({
        userId: project.userId,
        amount: creditsReserved - sceneCredits,
        description: `Veo 3.1 Lite scene (${scene.id}) — refund (actual cost less than reserved)`,
        videoProjectId: project.id,
      });
    } else if (sceneCredits > creditsReserved) {
      await consumeCredits({
        userId: project.userId,
        amount: sceneCredits - creditsReserved,
        type: "AI_GENERATION",
        description: `Veo 3.1 Lite scene (${scene.id}) — additional charge (actual cost exceeded reserved)`,
        videoProjectId: project.id,
      });
    }

    await tryFinalizeProject(project.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene render failed for an unknown reason.";
    const willRetry = job.attempts < job.maxAttempts;

    await prisma.$transaction(async (tx) => {
      await failJob(job.id, message, willRetry, tx);
      await tx.scene.update({
        where: { id: scene.id },
        data: { status: willRetry ? "PENDING" : "FAILED", errorMessage: message, attempts: { increment: 1 } },
      });
    });

    // Charge-before-generation refund (2026-07-24) — refund even when this
    // will retry: a retry re-reserves its own credits from scratch next
    // attempt (checkVideoActionAccess + consumeCredits run again at the top
    // of this function), so holding onto this attempt's reservation across
    // a retry would double-charge for one scene across 2 attempts.
    if (creditsReserved > 0) {
      await refundCredits({
        userId: project.userId,
        amount: creditsReserved,
        description: `Veo 3.1 Lite scene (${scene.id}) — generation failed, refunded`,
        videoProjectId: project.id,
      }).catch((refundErr) => console.error("Failed to refund credits after a failed GENERATED scene render", refundErr));
    }

    if (!willRetry) {
      await tryFinalizeProject(project.id);
    }
  }
}

// Milestone 11 Part 5/6 — a Talking Head scene's "render" is asset
// RESOLUTION, not generation-by-default: FACE_ONLY/TEXT_OVERLAY scenes need
// no asset at all (the base face-cam layer + a text overlay clip cover
// them); every other visualType asks the Intelligent Asset Selector
// (lib/talking-head/asset-selector.ts) which of the Part 5 waterfall tiers
// applies, and only the AI_IMAGE/AI_VIDEO tiers ever call generateImage()/
// renderVideo() — the SAME Generation Engine calls the GENERATED flow uses,
// not a parallel generation path. The resolved overlay is recorded as a
// normal Asset row (reused-asset decisions just point at the existing
// storageKey — no bytes move, no provider call) so
// lib/talking-head/timeline-plan.ts's applyAutomaticEditingPlan() can later
// find it via the Scene.assets relation, exactly like every other
// pipeline-produced asset.
async function renderTalkingHeadScene(
  job: RenderJob,
  scene: { id: string; visualType: SceneVisualType | null; imagePrompt: string | null; videoPrompt: string | null; prompt: string; negativePrompt: string | null; durationSeconds: number },
  project: { id: string; userId: string; sourceAssetId: string | null; aspectRatio: string },
  storage: StorageProvider,
  context: { videoProjectId: string; userId: string; sceneId: string }
): Promise<void> {
  const sourceAsset = await prisma.asset.findUniqueOrThrow({ where: { id: project.sourceAssetId! } });
  const videoKey = sourceAsset.storageKey;
  let imageKey: string | null = null;

  const decision = await resolveSceneAsset(scene, project);
  let creditCharge: { amount: number; description: string } | null = null;

  if (decision) {
    if (decision.kind === "AI_IMAGE") {
      const costs = await getConfig("TALKING_HEAD_CREDIT_COSTS");
      const amount = costs.aiImageCredits;
      // Checked before spending vendor cost on a request that would only
      // be rejected at charge time anyway; consumeCredits() re-validates
      // atomically below regardless, so this is an optimization, not the
      // only guard.
      if (amount > 0) {
        const balance = await getCreditBalance(project.userId);
        if (balance < amount) throw new InsufficientCreditsError(amount, balance);
      }

      const imageResult = await generateImage(
        { prompt: scene.imagePrompt ?? scene.prompt, negativePrompt: scene.negativePrompt ?? undefined, aspectRatio: project.aspectRatio as never },
        "scene_image",
        context
      );
      // Fixed (2026-07-24) — Talking Head's own AI-overlay-image decision
      // was completely unguarded against MOCK_PROVIDER_ID, same class of
      // gap as GENERATED's scene image above. Thrown before upload/persist
      // and before the credit charge below — propagates through this
      // function's caller's existing try/catch (processSceneRenderJob),
      // same retry/fail semantics as every other real render failure.
      if (imageResult.providerId === MOCK_PROVIDER_ID) {
        throw new Error(
          "Scene overlay image used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable. Check Admin → AI Providers, then try again."
        );
      }
      const imageObj = await storage.uploadFromUrl({
        key: `scenes/${scene.id}/overlay.jpg`,
        sourceUrl: imageResult.imageUrl,
        contentType: "image/jpeg",
      });
      imageKey = imageObj.key;
      await recordAsset({ userId: project.userId, kind: "IMAGE", source: "AI_GENERATED", storageKey: imageKey, videoProjectId: project.id, sceneId: scene.id });
      if (amount > 0) creditCharge = { amount, description: "AI overlay image" };
    } else if (decision.kind === "AI_VIDEO") {
      const costs = await getConfig("TALKING_HEAD_CREDIT_COSTS");
      const amount = Math.ceil(costs.aiVideoCreditsPerSecond * scene.durationSeconds);
      if (amount > 0) {
        const balance = await getCreditBalance(project.userId);
        if (balance < amount) throw new InsufficientCreditsError(amount, balance);
      }

      const finalQuality = await getConfig("FINAL_QUALITY");
      const videoResult = await renderVideo(
        {
          script: scene.videoPrompt ?? scene.prompt,
          negativePrompt: scene.negativePrompt ?? undefined,
          aspectRatio: project.aspectRatio as never,
          durationSeconds: scene.durationSeconds,
          quality: finalQuality,
        },
        "scene_render",
        context
      );
      const overlayObj = await storage.uploadFromUrl({
        key: `scenes/${scene.id}/overlay.mp4`,
        sourceUrl: videoResult.videoUrl,
        contentType: "video/mp4",
      });
      await recordAsset({ userId: project.userId, kind: "VIDEO", source: "AI_GENERATED", storageKey: overlayObj.key, videoProjectId: project.id, sceneId: scene.id });
      // Same gap fixed in generateVeoLiteVideo() (System B): a "successful"
      // renderVideo() call can be MockVideoProvider's placeholder once the
      // real chain is exhausted — never bill this scene's credits for that.
      if (amount > 0 && videoResult.providerId !== MOCK_PROVIDER_ID) creditCharge = { amount, description: "AI overlay video" };
    } else if (decision.candidate?.storageKey) {
      // REUSE_EXISTING / REUSE_BRAND / REUSE_UPLOADED — already a real
      // Asset row; link it to this scene with a new pointer row at the SAME
      // storageKey. No provider call, no bytes moved (Part 11's cost rule).
      await recordAsset({
        userId: project.userId,
        kind: decision.candidate.mediaKind as "IMAGE" | "VIDEO",
        source: decision.candidate.source,
        storageKey: decision.candidate.storageKey,
        videoProjectId: project.id,
        sceneId: scene.id,
      });
    } else if (decision.candidate?.url) {
      // STOCK — a static library URL (no pre-existing Asset row). Mirrored
      // into storage once so it has the same Asset-row shape as every other
      // decision kind for applyAutomaticEditingPlan() to consume uniformly.
      const stockObj = await storage.uploadFromUrl({ key: `scenes/${scene.id}/overlay-stock`, sourceUrl: decision.candidate.url });
      await recordAsset({
        userId: project.userId,
        kind: decision.candidate.mediaKind as "IMAGE" | "VIDEO",
        source: "STOCK",
        storageKey: stockObj.key,
        videoProjectId: project.id,
        sceneId: scene.id,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (creditCharge) {
      await consumeCredits(
        {
          userId: project.userId,
          amount: creditCharge.amount,
          type: "AI_GENERATION",
          description: creditCharge.description,
          videoProjectId: project.id,
        },
        tx
      );
    }
    await tx.scene.update({ where: { id: scene.id }, data: { status: "COMPLETED", videoKey, imageKey, errorMessage: null } });
    await completeJob(job.id, { videoKey, sceneId: scene.id }, tx);
  });
}

async function processMergeJob(job: RenderJob): Promise<void> {
  const project = await prisma.videoProject.findUniqueOrThrow({ where: { id: job.videoProjectId } });
  const scenes = await prisma.scene.findMany({ where: { videoProjectId: project.id }, orderBy: { order: "asc" } });

  try {
    const storage = await getStorageProvider();

    // AI Video reconciliation Step 2 — this used to call mergeSceneVideos()
    // (provider.mergeScenes() through the Generation Engine), real for
    // mock but a guaranteed throw-then-mock-fallback for every real video
    // vendor (Veo/Kling/Seedance all document "no generic scene-merge
    // capability") — meaning the final video was ALWAYS the mock placeholder
    // regardless of how real the per-scene clips were. Routes through the
    // Cloud Video Editor's Export Engine instead (the same vendor-
    // independent headless-browser-compositor + ffmpeg path AI Video Phase
    // 3's veo-multiscene-video.ts already proved live) — genuinely can't
    // fall back to a vendor placeholder because no vendor is involved in
    // this step at all. Preview/master watermark distinction is dropped in
    // this minimal pass — both URLs below point at the one real render; see
    // merge-via-editor.ts's doc comment for the tradeoff.
    const finalQuality = await getConfig("FINAL_QUALITY");
    // Real bug fix (2026-07-25) — voiceKey/backgroundMusicUrl were real,
    // already-generated per-scene data (this project's own generateVoiceover()
    // call above, and DEFAULT_BACKGROUND_MUSIC_URL) that never actually
    // reached the merged output until now — see merge-via-editor.ts's own
    // comment for the full real incident. backgroundMusicUrl is read once
    // (every scene shares the same admin-configured value by construction —
    // see lib/scenes/engine.ts's createScenesFromScript).
    const merged = await mergeScenesViaEditor({
      userId: project.userId,
      videoProjectId: project.id,
      aspectRatio: project.aspectRatio as never,
      finalQuality,
      scenes: scenes.map((s) => ({
        videoKey: s.videoKey!,
        durationSeconds: s.durationSeconds,
        subtitleText: s.subtitleText,
        voiceKey: s.voiceKey,
      })),
      backgroundMusicUrl: scenes[0]?.backgroundMusicUrl ?? null,
    });

    // Milestone 8 — the user can pick which scene's frame represents the
    // video in listings/sharing (Scene Editor's thumbnail selection); falls
    // back to the first scene when unset or the chosen scene has no image.
    const thumbnailScene =
      (project.thumbnailSceneId &&
        scenes.find((s) => s.id === project.thumbnailSceneId && s.status === "COMPLETED" && s.imageKey)) ||
      scenes[0];

    const thumbObj = await storage.uploadFromUrl({
      key: `videos/${project.id}/thumbnail.jpg`,
      sourceUrl: storage.getPublicUrl(thumbnailScene.imageKey!),
      contentType: "image/jpeg",
    });
    await Promise.all([
      recordAsset({ userId: project.userId, kind: "VIDEO", storageKey: merged.outputKey, videoProjectId: project.id, label: "Merged video" }),
      recordAsset({ userId: project.userId, kind: "IMAGE", storageKey: thumbObj.key, videoProjectId: project.id, label: "Thumbnail" }),
    ]);

    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

    await prisma.$transaction(async (tx) => {
      await tx.videoProject.updateMany({
        where: { id: project.id, status: { notIn: ["CANCELLED"] } },
        data: {
          status: "COMPLETED",
          previewVideoUrl: storage.getPublicUrl(merged.outputKey),
          previewThumbnailUrl: storage.getPublicUrl(thumbObj.key),
          masterVideoUrl: merged.outputKey,
          masterThumbnailUrl: storage.getPublicUrl(thumbObj.key),
          durationSeconds: totalDuration,
          errorMessage: null,
        },
      });
      await completeJob(job.id, { previewKey: merged.outputKey, masterKey: merged.outputKey }, tx);
    });

    void notifyUser({
      userId: project.userId,
      type: "RENDER_COMPLETE",
      title: "Your video is ready",
      body: `"${project.title}" finished rendering and is ready to preview.`,
      link: `/videos/${project.id}`,
    }).catch(() => undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Merge failed for an unknown reason.";
    const willRetry = job.attempts < job.maxAttempts;

    await prisma.$transaction(async (tx) => {
      await failJob(job.id, message, willRetry, tx);
      if (!willRetry) {
        await tx.videoProject.updateMany({
          where: { id: project.id, status: { notIn: ["CANCELLED"] } },
          data: { status: "FAILED", errorMessage: message, mergeQueued: false },
        });
      }
    });
  }
}

// Milestone 9 Export System — resolves one Clip's source URL given its track
// kind and its (mutually exclusive) Scene/Asset reference. A clip sourced
// from an Asset always wins (Media Library uploads/brand assets); otherwise
// the URL comes from whichever Scene artifact matches the track's kind.
// `content.sourceUrl` is the fallback for a clip with neither — the Media
// Library's "Stock" tab drags a STOCK_ASSET_LIBRARY entry straight onto the
// Timeline as a static URL reference, the same "admin-configured URL, no
// Asset row" pattern Scene.backgroundMusicUrl already uses. TEXT/STICKER/
// CAPTION clips have no source URL — their content lives entirely in
// `content`, passed through untouched.
function resolveClipSourceUrl(
  clip: { sceneId: string | null; assetId: string | null; content: unknown },
  trackKind: string,
  scene: { videoKey: string | null; imageKey: string | null; voiceKey: string | null; backgroundMusicUrl: string | null } | null,
  asset: { storageKey: string } | null,
  storage: StorageProvider
): string | undefined {
  if (asset) return storage.getPublicUrl(asset.storageKey);
  if (scene) {
    if (trackKind === "VIDEO" && scene.videoKey) return storage.getPublicUrl(scene.videoKey);
    if (trackKind === "IMAGE" && scene.imageKey) return storage.getPublicUrl(scene.imageKey);
    if (trackKind === "AUDIO" && scene.voiceKey) return storage.getPublicUrl(scene.voiceKey);
    if (trackKind === "MUSIC" && scene.backgroundMusicUrl) return scene.backgroundMusicUrl;
  }
  const content = clip.content as { sourceUrl?: string } | null;
  return content?.sourceUrl;
}

const EXPORT_QUALITY_MAP: Record<string, "720p" | "1080p" | "4K"> = {
  R720P: "720p",
  R1080P: "1080p",
  R4K: "4K",
};

// Export System (Milestone 9) — composites every Clip across every Track
// into one output file via the Generation Engine's composeTimeline()
// (lib/generation/video.ts), exactly the same engine renderVideo()/
// mergeSceneVideos() already use. No bespoke export orchestration: this is
// just a third RenderJob shape sharing the same claim/complete/fail queue.
async function processExportJob(job: RenderJob): Promise<void> {
  const payload = job.payload as { exportId: string };
  const exportRow = await prisma.export.findUniqueOrThrow({ where: { id: payload.exportId } });
  const project = await prisma.videoProject.findUniqueOrThrow({ where: { id: job.videoProjectId } });

  await prisma.export.update({ where: { id: exportRow.id }, data: { status: "PROCESSING" } });

  try {
    const storage = await getStorageProvider();
    const context = { videoProjectId: project.id, userId: project.userId };

    const clips = await prisma.clip.findMany({
      where: { videoProjectId: project.id },
      include: { track: true, scene: true, asset: true },
      orderBy: { startMs: "asc" },
    });

    const timelineClips: TimelineClipInput[] = clips.map((c) => ({
      trackKind: c.track.kind,
      startMs: c.startMs,
      durationMs: c.durationMs,
      sourceUrl: resolveClipSourceUrl(c, c.track.kind, c.scene, c.asset, storage),
      trimStartMs: c.trimStartMs || undefined,
      content: (c.content as Record<string, unknown> | null) ?? undefined,
    }));
    const totalDurationMs = clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);

    const watermarkText = exportRow.watermark ? await getConfig("WATERMARK_TEXT") : undefined;

    const composed = await composeTimeline(
      {
        totalDurationMs,
        aspectRatio: project.aspectRatio as never,
        clips: timelineClips,
        quality: EXPORT_QUALITY_MAP[exportRow.resolution],
        codec: exportRow.codec,
        watermarkText,
      },
      context
    );

    const outputObj = await storage.uploadFromUrl({
      key: `exports/${exportRow.id}/output.mp4`,
      sourceUrl: composed.videoUrl,
      contentType: "video/mp4",
    });
    await recordAsset({ userId: project.userId, kind: "VIDEO", storageKey: outputObj.key, videoProjectId: project.id, label: "Export" });

    await prisma.$transaction(async (tx) => {
      await tx.export.update({
        where: { id: exportRow.id },
        data: { status: "COMPLETED", outputKey: outputObj.key, errorMessage: null },
      });
      await completeJob(job.id, { outputKey: outputObj.key }, tx);
    });

    void notifyUser({
      userId: project.userId,
      type: "EXPORT_COMPLETE",
      title: "Your export is ready",
      body: `"${project.title}" finished exporting and is ready to download.`,
      link: `/videos/${project.id}/editor`,
    }).catch(() => undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed for an unknown reason.";
    const willRetry = job.attempts < job.maxAttempts;

    await prisma.$transaction(async (tx) => {
      await failJob(job.id, message, willRetry, tx);
      await tx.export.update({
        where: { id: exportRow.id },
        data: { status: willRetry ? "PENDING" : "FAILED", errorMessage: message },
      });
    });
  }
}

// AI Editing "Regenerate voice" (Milestone 9) — redoes ONLY the voiceover,
// unlike processSceneRenderJob which always redoes video+image+voice
// together. Deliberately leaves scene.durationSeconds untouched: the
// scene's video/image were already rendered at the original duration, so
// resizing the timeline here would desync them from the new voice track.
async function processRegenVoiceJob(job: RenderJob): Promise<void> {
  const scene = await prisma.scene.findUniqueOrThrow({
    where: { id: job.sceneId! },
    include: { videoProject: true },
  });
  const project = scene.videoProject;

  try {
    const storage = await getStorageProvider();
    const context = { videoProjectId: project.id, userId: project.userId, sceneId: scene.id };

    const voice = await generateVoiceover(
      {
        script: scene.prompt,
        contentLanguage: project.contentLanguage as never,
        voiceId: scene.voiceId ?? undefined,
      },
      context
    );
    // Same MOCK_PROVIDER_ID guard as processSceneRenderJob's voice check
    // (2026-07-23 audit finding) — this is the user-facing "regenerate
    // voiceover" action, so silently persisting a mock result here is
    // exactly as misleading as the initial scene render doing it.
    if (voice.providerId === MOCK_PROVIDER_ID) {
      throw new Error(
        "Voice regeneration used the placeholder provider, not a real one — no VOICE provider is currently enabled and reachable. Check Admin → AI Providers, then try again."
      );
    }
    const voiceObj = await storage.uploadFromUrl({
      key: `scenes/${scene.id}/voice.mp3`,
      sourceUrl: voice.audioUrl,
      contentType: "audio/mpeg",
    });
    await recordAsset({ userId: project.userId, kind: "VOICE", storageKey: voiceObj.key, videoProjectId: project.id, sceneId: scene.id });

    await prisma.$transaction(async (tx) => {
      await tx.scene.update({ where: { id: scene.id }, data: { voiceKey: voiceObj.key, errorMessage: null } });
      await completeJob(job.id, { voiceKey: voiceObj.key }, tx);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice regeneration failed for an unknown reason.";
    const willRetry = job.attempts < job.maxAttempts;
    await failJob(job.id, message, willRetry);
  }
}

// Milestone 11 Part 2 — Speech Intelligence. The first step of the Talking
// Head pipeline: transcribes the uploaded source video via the Transcription
// Generation Engine category (failover/retry/cost-tracking for free, same
// engine as LLM/Image/Voice/Video), then derives paragraph segmentation via
// the pure functions in lib/transcription/segmentation.ts (not a second
// provider call). Free — no credits are charged here (Part 12's confirmed
// boundary: charging starts at actual AI generation/export).
async function processTranscribeJob(job: RenderJob): Promise<void> {
  const payload = job.payload as { sourceAssetId: string };
  const project = await prisma.videoProject.findUniqueOrThrow({ where: { id: job.videoProjectId } });
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: payload.sourceAssetId } });

  try {
    const storage = await getStorageProvider();
    const context = { videoProjectId: project.id, userId: project.userId };
    const audioUrl = resolveAbsoluteUrl(storage.getPublicUrl(asset.storageKey));

    const result = await transcribeAudio({ audioUrl, language: project.contentLanguage === "EN" ? "en" : undefined }, context);

    const silenceGaps = detectSilenceGaps(result.words);
    const paragraphIndices = assignParagraphIndices(result.segments, silenceGaps);

    await prisma.$transaction(async (tx) => {
      const transcript = await tx.transcript.create({
        data: {
          videoProjectId: project.id,
          sourceAssetId: asset.id,
          language: result.language,
          durationSeconds: result.durationSeconds,
          providerId: result.providerId,
        },
      });

      await tx.transcriptSegment.createMany({
        data: result.segments.map((seg, i) => ({
          transcriptId: transcript.id,
          order: i,
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: seg.text,
          paragraphIndex: paragraphIndices[i] ?? 0,
          wordTimings: wordsWithinSegment(result.words, seg) as unknown as Prisma.InputJsonValue,
        })),
      });

      // Automatically continues into Part 3/4 (context analysis + visual
      // planning) — both still free (Part 12's confirmed boundary), so there
      // is no reason to make the user manually trigger the next step.
      await tx.renderJob.create({
        data: {
          videoProjectId: project.id,
          maxAttempts: job.maxAttempts,
          payload: { kind: "analyze", transcriptId: transcript.id },
        },
      });

      await completeJob(job.id, { transcriptId: transcript.id, segmentCount: result.segments.length }, tx);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed for an unknown reason.";
    const willRetry = job.attempts < job.maxAttempts;
    await failJob(job.id, message, willRetry);
    if (!willRetry) {
      await prisma.videoProject.updateMany({
        where: { id: project.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        data: { status: "FAILED", errorMessage: message },
      });
    }
  }
}

// Milestone 11 Parts 3/4 — AI Context Understanding + AI Visual Planner.
// One RenderJob kind covers both: transcription is the slow audio step,
// these two are fast text-only LLM calls with no reason to pay two extra
// queue hops. groupSegmentsIntoScenes() (lib/talking-head/visual-planner.ts)
// is the literal replacement for lib/scenes/engine.ts's
// splitScriptIntoSceneTexts() — everything downstream of Scene creation
// (Timeline, Editor, Queue, Credits, Versioning) is unaware anything is
// different. All writes happen in one final transaction, after every LLM
// call has already succeeded, so a mid-way failure retries cleanly with no
// partial Scene rows left behind.
async function processAnalyzeJob(job: RenderJob): Promise<void> {
  const payload = job.payload as { transcriptId: string };
  const project = await prisma.videoProject.findUniqueOrThrow({ where: { id: job.videoProjectId } });

  try {
    const segments = await prisma.transcriptSegment.findMany({
      where: { transcriptId: payload.transcriptId },
      orderBy: { order: "asc" },
    });

    if (segments.length === 0) {
      await completeJob(job.id, { sceneCount: 0 });
      return;
    }

    const context = { videoProjectId: project.id, userId: project.userId };

    const analysisBatches = chunkSegments(
      segments.map((s) => ({ order: s.order, text: s.text })),
      CONTEXT_ANALYSIS_BATCH_SIZE
    );
    const analyses: SegmentAnalysis[] = [];
    for (const batch of analysisBatches) {
      const batchResult = await runContextAnalysisBatch(batch, context);
      analyses.push(...batchResult.analyses);
    }

    const planInputs: VisualPlanInput[] = segments.map((s, i) => ({
      order: s.order,
      text: s.text,
      tags: analyses[i]?.tags ?? [],
      isHook: analyses[i]?.isHook ?? false,
      isCTA: analyses[i]?.isCTA ?? false,
    }));
    const planBatches = chunkSegments(planInputs, CONTEXT_ANALYSIS_BATCH_SIZE);
    const visualTypes: SceneVisualType[] = [];
    for (const batch of planBatches) {
      const batchResult = await runVisualPlanningBatch(batch, context);
      visualTypes.push(...batchResult.visualTypes);
    }

    const grouped = groupSegmentsIntoScenes(
      segments.map((s) => ({
        id: s.id,
        order: s.order,
        text: s.text,
        startMs: s.startMs,
        endMs: s.endMs,
        paragraphIndex: s.paragraphIndex,
      })),
      visualTypes
    );

    const [negativePrompt, backgroundMusicUrl] = await Promise.all([
      getConfig("DEFAULT_NEGATIVE_PROMPT"),
      getConfig("DEFAULT_BACKGROUND_MUSIC_URL"),
    ]);

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        segments.map((s, i) =>
          tx.transcriptSegment.update({
            where: { id: s.id },
            data: { analysis: analyses[i] as unknown as Prisma.InputJsonValue },
          })
        )
      );

      for (const scene of grouped) {
        const created = await tx.scene.create({
          data: {
            videoProjectId: project.id,
            order: scene.order,
            prompt: scene.text,
            subtitleText: scene.text,
            visualType: scene.visualType,
            negativePrompt: negativePrompt || null,
            durationSeconds: scene.durationSeconds,
            backgroundMusicUrl: backgroundMusicUrl || null,
          },
        });
        await tx.transcriptSegment.updateMany({
          where: { id: { in: scene.segmentIds } },
          data: { sceneId: created.id },
        });
      }

      // Mirrors the GENERATED flow's SCRIPT_READY: the AI plan exists,
      // awaiting the user's review/confirmation (Part 4's "allow manual
      // edits") before anything billable runs.
      await tx.videoProject.update({ where: { id: project.id }, data: { status: "SCRIPT_READY" } });
      await completeJob(job.id, { sceneCount: grouped.length }, tx);
    });

    await recordProjectVersion(project.id, project.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed for an unknown reason.";
    const willRetry = job.attempts < job.maxAttempts;
    await failJob(job.id, message, willRetry);
    if (!willRetry) {
      await prisma.videoProject.updateMany({
        where: { id: project.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        data: { status: "FAILED", errorMessage: message },
      });
    }
  }
}

// ============================================================================
// User-facing render-run controls (pause/resume/cancel/re-render-failed).
// Pause/cancel can only affect not-yet-claimed (PENDING) jobs — a job already
// PROCESSING when the user acts is left to finish naturally; there is no
// preemption of in-flight work.
// ============================================================================

export async function pauseProject(videoProjectId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.videoProject.updateMany({
      where: { id: videoProjectId, userId, status: { in: ["QUEUED", "RENDERING"] } },
      data: { status: "PAUSED" },
    });
    if (claimed.count === 0) throw new InvalidStateError("Only a queued or rendering video can be paused.");

    await tx.renderJob.updateMany({
      where: { videoProjectId, status: "PENDING" },
      data: { status: "PAUSED" },
    });
  });
}

export async function resumeProject(videoProjectId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.videoProject.updateMany({
      where: { id: videoProjectId, userId, status: "PAUSED" },
      data: { status: "RENDERING" },
    });
    if (claimed.count === 0) throw new InvalidStateError("Only a paused video can be resumed.");

    await tx.renderJob.updateMany({
      where: { videoProjectId, status: "PAUSED" },
      data: { status: "PENDING" },
    });
  });
}

export async function cancelInProgressRender(videoProjectId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.videoProject.updateMany({
      where: { id: videoProjectId, userId, status: { in: ["QUEUED", "RENDERING", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });
    if (claimed.count === 0) throw new InvalidStateError("This video is not currently rendering.");

    await tx.renderJob.updateMany({
      where: { videoProjectId, status: { in: ["PENDING", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });
    await tx.scene.updateMany({
      where: { videoProjectId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
  });
}

export interface RerenderResult {
  requeuedScenes: number;
}

// Resets every FAILED scene to PENDING and queues a fresh render job for
// each — only the scenes that actually failed are re-rendered (the caching
// requirement). If no scene failed (the merge itself did), re-queues the
// merge alone instead.
export async function rerenderFailedScenes(videoProjectId: string): Promise<RerenderResult> {
  const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.videoProject.updateMany({
      where: { id: videoProjectId, status: "FAILED" },
      data: { status: "RENDERING", errorMessage: null, mergeQueued: false },
    });
    if (claimed.count === 0) throw new InvalidStateError("Only a failed video can have its scenes re-rendered.");

    const failedScenes = await tx.scene.findMany({ where: { videoProjectId, status: "FAILED" }, select: { id: true } });

    if (failedScenes.length === 0) {
      await enqueueJob({ videoProjectId, maxAttempts }, tx);
      return { requeuedScenes: 0 };
    }

    await tx.scene.updateMany({
      where: { id: { in: failedScenes.map((s) => s.id) } },
      data: { status: "PENDING", errorMessage: null },
    });
    await tx.renderJob.createMany({
      data: failedScenes.map((s) => ({ videoProjectId, sceneId: s.id, maxAttempts, payload: {} })),
    });
    return { requeuedScenes: failedScenes.length };
  });
}

// ============================================================================
// AI Editing (Milestone 9) — "Regenerate scene" and "Regenerate voice".
// Both create a tagged RenderJob and let the EXISTING processors pick it up
// unchanged: regenerateScene resets the scene to PENDING (so the unmodified
// processSceneRenderJob's own claim-transition matches it, even though the
// scene may already be COMPLETED), while regenerateSceneVoice doesn't touch
// scene/project status at all — it's an isolated artifact swap handled by
// the new processRegenVoiceJob above. "Replace scene" and "Change image/
// video prompt" need no RenderJob at all (see lib/timeline/engine.ts's
// replaceClipSource and the existing scene PATCH route, respectively).
// ============================================================================

export interface RegenerateScenePromptOverrides {
  imagePrompt?: string;
  videoPrompt?: string;
}

// The Editor's "Change image prompt"/"Change video prompt" are deliberately
// NOT routed through PATCH .../scenes/[sceneId] (that route only allows
// edits while a scene is DRAFT/FAILED — editing a COMPLETED scene's prompt
// there would race the worker). Instead the prompt change and the PENDING
// reset happen together, in the same transaction, so a new prompt is only
// ever applied to a scene that's simultaneously being taken out of
// COMPLETED for a fresh render — never to a scene still in active use.
export async function regenerateScene(
  videoProjectId: string,
  userId: string,
  sceneId: string,
  promptOverrides?: RegenerateScenePromptOverrides
): Promise<void> {
  const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");

  await prisma.$transaction(async (tx) => {
    const scene = await tx.scene.findFirst({ where: { id: sceneId, videoProjectId } });
    if (!scene) throw new InvalidStateError("Scene not found in this project.");

    const claimed = await tx.videoProject.updateMany({
      where: { id: videoProjectId, userId, status: { notIn: ["CANCELLED"] } },
      data: { status: "RENDERING", mergeQueued: false, errorMessage: null },
    });
    if (claimed.count === 0) throw new InvalidStateError("Video project not found or cannot be re-rendered.");

    await tx.scene.update({
      where: { id: sceneId },
      data: {
        status: "PENDING",
        errorMessage: null,
        ...(promptOverrides?.imagePrompt !== undefined ? { imagePrompt: promptOverrides.imagePrompt || null } : {}),
        ...(promptOverrides?.videoPrompt !== undefined ? { videoPrompt: promptOverrides.videoPrompt || null } : {}),
      },
    });
    await tx.renderJob.create({ data: { videoProjectId, sceneId, maxAttempts, payload: { kind: "regen_scene" } } });
  });
}

export async function regenerateSceneVoice(videoProjectId: string, userId: string, sceneId: string): Promise<void> {
  const project = await prisma.videoProject.findFirst({ where: { id: videoProjectId, userId } });
  if (!project) throw new InvalidStateError("Video project not found.");

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, videoProjectId } });
  if (!scene) throw new InvalidStateError("Scene not found in this project.");

  const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");
  await prisma.renderJob.create({
    data: { videoProjectId, sceneId, maxAttempts, payload: { kind: "regen_voice" } },
  });
}
