import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { consumeCredits, refundCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess } from "@/lib/credits/video-actions";
import { generateImage } from "@/lib/generation/image";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";

// FILM storyboard preview images (2026-07-24) — one cheap real image per
// scene, generated right after the storyboard is planned, so the user can
// see roughly what each scene will look like before committing to the
// (20-100x more expensive) real video generation. Deliberately NOT built
// like generateFilmSceneVideo()'s hard-fail-on-mock-fallback contract: this
// is an optional pre-commit enhancement, not the user's final deliverable —
// a real provider outage here should degrade to "no preview available" for
// that one scene, never block the whole storyboard from being usable.
// Charge-before-generation still applies (same reserve/refund-on-failure
// pattern as every other real generation action, 2026-07-24) since a real
// credit is still spent whenever a real image is actually produced.

const FILM_PREVIEW_ACTION_KEY = "film_storyboard_preview";

export interface GenerateFilmScenePreviewInput {
  userId: string;
  videoProjectId: string;
  sceneId: string;
  prompt: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  /** The scene's linked character's own resolved reference photo, same resolution as generateFilmSceneVideo()'s startImageAssetId. Omitted for a b-roll/no-character scene. */
  startImageAssetId?: string;
}

export interface GenerateFilmScenePreviewResult {
  /** Null when the precheck fails (e.g. insufficient tier/credits) or the real generation didn't produce a usable result (provider outage, mock fallback) — callers should treat this as "no preview available," not an error. */
  previewImageKey: string | null;
  creditsCharged: number;
}

export async function generateFilmScenePreview(input: GenerateFilmScenePreviewInput): Promise<GenerateFilmScenePreviewResult> {
  let credits: number;
  try {
    ({ credits } = await checkVideoActionAccess(input.userId, FILM_PREVIEW_ACTION_KEY));
  } catch (err) {
    // Insufficient tier/credits for the preview specifically — degrade
    // gracefully rather than blocking storyboard creation (which already
    // separately gated the real "film" action's own tier/credit precheck).
    console.warn(`Skipping storyboard preview for scene ${input.sceneId}: ${err instanceof Error ? err.message : err}`);
    return { previewImageKey: null, creditsCharged: 0 };
  }

  if (credits > 0) {
    await consumeCredits({
      userId: input.userId,
      amount: credits,
      type: "AI_GENERATION",
      description: "AI Film storyboard preview image",
      videoProjectId: input.videoProjectId,
    });
  }

  try {
    let referenceImage: { mimeType: string; data: string } | undefined;
    if (input.startImageAssetId) {
      const imageAsset = await prisma.asset.findFirst({ where: { id: input.startImageAssetId, userId: input.userId } });
      if (imageAsset) {
        const storage = await getStorageProvider();
        const buffer = await storage.download(imageAsset.storageKey);
        referenceImage = { mimeType: imageAsset.mimeType ?? "image/jpeg", data: buffer.toString("base64") };
      }
    }

    const result = await generateImage(
      { prompt: input.prompt, aspectRatio: input.aspectRatio, referenceImages: referenceImage ? [referenceImage] : undefined },
      "film_scene_preview",
      { userId: input.userId, videoProjectId: input.videoProjectId, sceneId: input.sceneId }
    );

    if (result.providerId === MOCK_PROVIDER_ID) {
      // Never persist/bill a fake placeholder as a real preview — but
      // (unlike the real video-generation flows) this degrades gracefully
      // rather than throwing, since a missing preview just means the scene
      // shows text-only, same as before this feature existed.
      await refundCredits({
        userId: input.userId,
        amount: credits,
        description: "AI Film storyboard preview — refund (no real IMAGE provider available)",
        videoProjectId: input.videoProjectId,
      });
      return { previewImageKey: null, creditsCharged: 0 };
    }

    const { buffer, contentType } = await toBuffer(result.imageUrl);
    const storage = await getStorageProvider();
    const uploaded = await storage.upload({
      key: `film/${input.videoProjectId}/scenes/${input.sceneId}/preview.jpg`,
      data: buffer,
      contentType: contentType || "image/jpeg",
    });

    await prisma.scene.update({ where: { id: input.sceneId }, data: { previewImageKey: uploaded.key } });

    return { previewImageKey: uploaded.key, creditsCharged: credits };
  } catch (err) {
    console.error(`Storyboard preview generation failed for scene ${input.sceneId} (refunding, degrading gracefully)`, err);
    if (credits > 0) {
      await refundCredits({
        userId: input.userId,
        amount: credits,
        description: "AI Film storyboard preview — generation failed, refunded",
        videoProjectId: input.videoProjectId,
      }).catch((refundErr) => console.error("Failed to refund credits after a failed storyboard preview", refundErr));
    }
    return { previewImageKey: null, creditsCharged: 0 };
  }
}
