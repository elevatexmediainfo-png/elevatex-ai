import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { recordAsset } from "@/lib/assets/service";
import { consumeCredits, refundCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess, resolveVideoProviderCredits } from "@/lib/credits/video-actions";
import { renderVideo, generateVoiceoverOrDegrade } from "@/lib/generation";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import type { VideoRenderRequest } from "@/lib/providers/video";
import { FILM_SCENE_GENERATION_FLOOR_SECONDS } from "@/lib/creative/film-storyboard";

// AI Film — per-scene video generation. Mirrors generateVeoLiteVideo()
// (AI Video Phase 2) exactly — same precheck-then-charge-after-success
// shape, same recordAsset()+consumeCredits() atomic transaction, same
// mock-fallback-never-billed guard — the proven pattern the founder asked
// to reuse, not a new mechanism. The one real difference: conditioning.
// generateVeoLiteVideo()'s startImage is optional/caller's choice; here
// it's the whole point — 2026-07-12's founder decision locked in
// reference-image anchoring (Variant B) as the consistency method, so
// scenes/[sceneId]/generate/route.ts always resolves the scene's linked
// FilmCharacter's own stored photo (never a chained previous-scene frame)
// and passes it here as startImageAssetId. A scene with no character
// (b-roll/establishing shot) passes none — falls through to the exact
// same text-only path VeoLiteVideo already has, no special-casing needed.
//
// Uses the "film_scene" action key (not "veo_lite", not the generic "film"
// key the founder's original instruction named) — split out 2026-07-19 from
// the generic "film" key once real per-scene cost data existed and needed
// pricing: "film" is also shared by storyboard/variations/character-sheet
// generation (much cheaper LLM/image calls), so pricing per-scene video
// render there would have silently repriced those too. See
// VIDEO_ACTION_CREDIT_COSTS.film_scene (lib/admin/config.ts) for the real
// cost math (DB-verified $4.20/scene).
const FILM_ACTION_KEY = "film_scene";

export class FilmSceneVideoError extends Error {}

export interface GenerateFilmSceneVideoInput {
  userId: string;
  videoProjectId: string;
  sceneId: string;
  prompt: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  /** The scene's SHORT, intended on-screen duration (2-3s, fast-cut storyboard model) — NOT necessarily what's actually requested from the vendor; see the real renderVideo() call below for why. */
  durationSeconds: number;
  negativePrompt?: string;
  /** The scene's linked character's own resolved reference photo (resolveFilmCharacterReferenceAssetId()) — reference-image anchoring, not a chained previous-scene frame. Omitted for a b-roll/no-character scene. */
  startImageAssetId?: string;
  /** User-facing video-provider selector — reordered to the front of the failover chain, not a hard restriction (see renderVideo()'s own comment). */
  preferredProviderId?: string;
  /** Real voice-over support (2026-07-25) — the scene's own spokenLine (storyboard-planned, stored on Scene). The video model no longer renders this itself (film-storyboard.ts's own comment) — a real, separate ElevenLabs narration is generated here and dubbed over the clip at merge time instead. Null/undefined for a b-roll/no-character scene with nothing to say. */
  spokenLine?: string | null;
  contentLanguage?: "EN" | "HI" | "HINGLISH";
}

export interface GenerateFilmSceneVideoResult {
  assetId: string;
  videoKey: string;
  creditsCharged: number;
  /** True when the Generation Engine's failover chain was exhausted and this clip is MockVideoProvider's canned placeholder, not a real Veo render — same "flower" lesson every other real-video path in this codebase already guards against. */
  isMockFallback: boolean;
  /** The provider that actually rendered this clip — compare against the caller's own requested preferredProviderId to detect a real fallback happened. */
  providerId: string;
  /** Real voice-over support (2026-07-25) — the generated narration's storage key, for the caller to persist onto Scene.voiceKey (same field/convention GENERATED already uses) so merge-via-editor.ts can pick it up. Null when the scene had no spokenLine. */
  voiceKey: string | null;
  /** Real-resilience support (2026-07-25) — non-null when the scene had a spokenLine but no real VOICE provider could produce it (all failed, or only the mock placeholder was reachable). The scene still completes with real visuals — this is a caller-visible, honest "narration unavailable" signal, not a silent gap. Null when narration wasn't requested or genuinely succeeded. */
  narrationSkippedReason: string | null;
}

export async function generateFilmSceneVideo(input: GenerateFilmSceneVideoInput): Promise<GenerateFilmSceneVideoResult> {
  // Precheck — cheap, avoids reserving credits for a request that would be
  // rejected anyway; consumeCredits() below re-validates atomically.
  const { credits } = await checkVideoActionAccess(input.userId, FILM_ACTION_KEY);

  // Charge-before-generation (2026-07-24) — reserved here, refunded on any
  // failure, true-up settled against the real final cost on success. Same
  // pattern/reasoning as generateVeoLiteVideo() — see its own comment.
  if (credits > 0) {
    await consumeCredits({ userId: input.userId, amount: credits, type: "AI_GENERATION", description: "AI Film scene generation", videoProjectId: input.videoProjectId });
  }

  try {
    let startImage: VideoRenderRequest["startImage"];
    if (input.startImageAssetId) {
      const imageAsset = await prisma.asset.findFirst({ where: { id: input.startImageAssetId, userId: input.userId } });
      if (!imageAsset) throw new FilmSceneVideoError("The character's reference photo couldn't be found.");
      const storage = await getStorageProvider();
      const buffer = await storage.download(imageAsset.storageKey);
      startImage = { mimeType: imageAsset.mimeType ?? "image/jpeg", data: buffer.toString("base64") };
    }

    // Video + voice generated in parallel (2026-07-25) — independent vendor
    // calls, same real efficiency pattern as GENERATED's
    // Promise.all([renderVideo, generateImage]) in pipeline.ts.
    //
    // Real policy change (2026-07-25) — a voice failure used to fail the
    // WHOLE scene (hard-fail, full refund). That was the right call when
    // the actual complaint was "there's no music/voice at all and nothing
    // says so" (a SILENT gap). It stopped being the right call once a real
    // voice failure — e.g. ElevenLabs's free-plan library-voice restriction
    // — started blocking generation entirely even though the video itself
    // rendered fine. generateVoiceoverOrDegrade() never throws for a voice
    // problem: it degrades to voice:null + a human-readable reason instead,
    // so a real, finished video is never discarded over narration alone.
    // What's UNCHANGED: a mock/placeholder result is still never accepted
    // as real narration (generateVoiceoverOrDegrade enforces that itself).
    const [result, voiceOutcome] = await Promise.all([
      renderVideo(
        {
          script: input.prompt,
          negativePrompt: input.negativePrompt,
          aspectRatio: input.aspectRatio,
          // Real vendor-floor fix (2026-07-25) — no currently-eligible VIDEO
          // provider can natively render a 2-3s clip (Seedance2.ai's real
          // documented floor is 4s; see film-storyboard.ts's own investigation
          // comment for the full evidence). Request the real vendor minimum
          // here, but input.durationSeconds (the SHORT intended value) is
          // still what gets persisted on Scene and later used by
          // merge-via-editor.ts to build the timeline clip — so the merged
          // output naturally trims each longer generated clip down to its
          // punchy 2-3s window via addClip()'s existing trimStartMs=0/
          // durationMs mechanism, already respected by the real render
          // pipeline. No separate trim step needed here.
          durationSeconds: Math.max(input.durationSeconds, FILM_SCENE_GENERATION_FLOOR_SECONDS),
          quality: "1080p",
          startImage,
        },
        "scene_render",
        { userId: input.userId, videoProjectId: input.videoProjectId, sceneId: input.sceneId },
        input.preferredProviderId,
        // Real progress feedback (2026-07-25) — persisted so
        // scenes/[sceneId]/progress/route.ts can report real attempt/retry
        // state back to the frontend while this render is in flight (see
        // that route's own comment for the real ~10-minute wait this fixes).
        // Best-effort: a failed progress write must never fail the actual
        // render it's just reporting on.
        (event) =>
          prisma.scene
            .update({
              where: { id: input.sceneId },
              data: { renderProgress: { ...event, updatedAt: new Date().toISOString() } },
            })
            .then(() => {})
            .catch((err) => console.error(`Failed to persist render progress for scene ${input.sceneId}`, err))
      ),
      input.spokenLine?.trim()
        ? generateVoiceoverOrDegrade(
            { script: input.spokenLine.trim(), contentLanguage: input.contentLanguage ?? "EN" },
            { userId: input.userId, videoProjectId: input.videoProjectId, sceneId: input.sceneId }
          )
        : Promise.resolve(null),
    ]);

    // Never charge for a mock/placeholder clip — the same providerId/
    // MOCK_PROVIDER_ID guard every other real-video path in this codebase
    // uses (generateVeoLiteVideo(), processSceneRenderJob()).
    const isMockFallback = result.providerId === MOCK_PROVIDER_ID;
    // Charged for whichever provider actually rendered this (result.providerId),
    // not whichever the user requested — see veo-lite-video.ts's identical comment.
    const actualCredits = isMockFallback ? 0 : await resolveVideoProviderCredits(credits, result.providerId);

    const { buffer, contentType } = await toBuffer(result.videoUrl);
    const storage = await getStorageProvider();
    const uploaded = await storage.upload({
      key: `film/${input.videoProjectId}/scenes/${input.sceneId}/video.mp4`,
      data: buffer,
      contentType: contentType || "video/mp4",
    });

    let voiceKey: string | null = null;
    if (voiceOutcome?.voice) {
      const voiceObj = await storage.uploadFromUrl({
        key: `film/${input.videoProjectId}/scenes/${input.sceneId}/voice.mp3`,
        sourceUrl: voiceOutcome.voice.audioUrl,
        contentType: "audio/mpeg",
      });
      voiceKey = voiceObj.key;
    }

    const asset = await prisma.$transaction(async (tx) =>
      recordAsset(
        {
          userId: input.userId,
          kind: "VIDEO",
          source: "AI_GENERATED",
          storageKey: uploaded.key,
          label: "AI Film — scene",
          videoProjectId: input.videoProjectId,
          sceneId: input.sceneId,
        },
        tx
      )
    );

    if (actualCredits < credits) {
      await refundCredits({
        userId: input.userId,
        amount: credits - actualCredits,
        description: "AI Film scene generation — refund (actual cost less than reserved)",
        videoProjectId: input.videoProjectId,
      });
    } else if (actualCredits > credits) {
      await consumeCredits({
        userId: input.userId,
        amount: actualCredits - credits,
        type: "AI_GENERATION",
        description: "AI Film scene generation — additional charge (actual cost exceeded reserved)",
        videoProjectId: input.videoProjectId,
      });
    }

    return {
      assetId: asset.id,
      videoKey: uploaded.key,
      creditsCharged: actualCredits,
      isMockFallback,
      providerId: result.providerId,
      voiceKey,
      narrationSkippedReason: voiceOutcome?.narrationSkippedReason ?? null,
    };
  } catch (err) {
    if (credits > 0) {
      await refundCredits({
        userId: input.userId,
        amount: credits,
        description: "AI Film scene generation — generation failed, refunded",
        videoProjectId: input.videoProjectId,
      }).catch((refundErr) => console.error("Failed to refund credits after a failed Film scene generation", refundErr));
    }
    throw err;
  }
}
