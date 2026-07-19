import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { recordAsset } from "@/lib/assets/service";
import { consumeCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess } from "@/lib/credits/video-actions";
import { renderVideo } from "@/lib/generation/video";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import type { VideoRenderRequest } from "@/lib/providers/video";

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
  durationSeconds: number;
  negativePrompt?: string;
  /** The scene's linked character's own resolved reference photo (resolveFilmCharacterReferenceAssetId()) — reference-image anchoring, not a chained previous-scene frame. Omitted for a b-roll/no-character scene. */
  startImageAssetId?: string;
}

export interface GenerateFilmSceneVideoResult {
  assetId: string;
  videoKey: string;
  creditsCharged: number;
  /** True when the Generation Engine's failover chain was exhausted and this clip is MockVideoProvider's canned placeholder, not a real Veo render — same "flower" lesson every other real-video path in this codebase already guards against. */
  isMockFallback: boolean;
}

export async function generateFilmSceneVideo(input: GenerateFilmSceneVideoInput): Promise<GenerateFilmSceneVideoResult> {
  // Precheck — cheap, avoids spending a real Veo call on a request that
  // would be rejected anyway; consumeCredits() re-validates atomically below.
  const { credits } = await checkVideoActionAccess(input.userId, FILM_ACTION_KEY);

  let startImage: VideoRenderRequest["startImage"];
  if (input.startImageAssetId) {
    const imageAsset = await prisma.asset.findFirst({ where: { id: input.startImageAssetId, userId: input.userId } });
    if (!imageAsset) throw new FilmSceneVideoError("The character's reference photo couldn't be found.");
    const storage = await getStorageProvider();
    const buffer = await storage.download(imageAsset.storageKey);
    startImage = { mimeType: imageAsset.mimeType ?? "image/jpeg", data: buffer.toString("base64") };
  }

  const result = await renderVideo(
    {
      script: input.prompt,
      negativePrompt: input.negativePrompt,
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      quality: "1080p",
      startImage,
    },
    "scene_render",
    { userId: input.userId, videoProjectId: input.videoProjectId, sceneId: input.sceneId }
  );

  // Never charge for a mock/placeholder clip — the same providerId/
  // MOCK_PROVIDER_ID guard every other real-video path in this codebase
  // uses (generateVeoLiteVideo(), processSceneRenderJob()).
  const isMockFallback = result.providerId === MOCK_PROVIDER_ID;
  const creditsToCharge = isMockFallback ? 0 : credits;

  const { buffer, contentType } = await toBuffer(result.videoUrl);
  const storage = await getStorageProvider();
  const uploaded = await storage.upload({
    key: `film/${input.videoProjectId}/scenes/${input.sceneId}/video.mp4`,
    data: buffer,
    contentType: contentType || "video/mp4",
  });

  const asset = await prisma.$transaction(async (tx) => {
    const asset = await recordAsset(
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
    );
    if (creditsToCharge > 0) {
      await consumeCredits(
        {
          userId: input.userId,
          amount: creditsToCharge,
          type: "AI_GENERATION",
          description: "AI Film scene generation",
          videoProjectId: input.videoProjectId,
        },
        tx
      );
    }
    return asset;
  });

  return { assetId: asset.id, videoKey: uploaded.key, creditsCharged: creditsToCharge, isMockFallback };
}
