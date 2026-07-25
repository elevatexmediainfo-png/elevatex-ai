import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { InsufficientTierError } from "@/lib/credits/video-actions";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { resolveFilmCharacterReferenceAssetId } from "@/lib/film/types";
import { appendCharacterSheetContext } from "@/lib/creative/film-character-prompt";
import { generateFilmSceneVideo, FilmSceneVideoError } from "@/lib/creative/film-scene-video";
import type { Scene, VideoProject } from "@/generated/prisma/client";

// Real progress feedback (2026-07-25) — every path below that leaves the
// scene in a terminal state (COMPLETED or FAILED) also clears renderProgress
// (film-scene-video.ts's onProgress callback wrote it mid-render) — a stale
// "attempt 2 of 3, retrying" reading left behind after the scene is already
// done/failed would be actively misleading, not just unhelpful.
const CLEAR_RENDER_PROGRESS = { renderProgress: Prisma.JsonNull } as const;

// Extracted 2026-07-23 (single-scene "Generate scene" button's own real
// logic, unchanged) so the new bulk "Approve storyboard & generate all
// scenes" action (scenes/generate-all/route.ts) can reuse the EXACT same
// per-scene generation + mock-fallback-hard-fail + persistence semantics
// instead of a second, drifting copy — the single-scene route
// (scenes/[sceneId]/generate/route.ts) now just maps this result onto an
// HTTP response, all the real work lives here once.
export type GenerateAndPersistFilmSceneResult =
  | { ok: true; scene: Scene; creditsCharged: number; providerId: string; narrationSkippedReason: string | null }
  | { ok: false; code: "ERR_TIER_REQUIRED" | "ERR_INSUFFICIENT_CREDITS" | "ERR_VALIDATION" | "ERR_MOCK_FALLBACK" | "ERR_INTERNAL"; message: string; httpStatus: number };

export async function generateAndPersistFilmScene(
  userId: string,
  project: Pick<VideoProject, "id" | "aspectRatio">,
  scene: Scene,
  preferredProviderId?: string
): Promise<GenerateAndPersistFilmSceneResult> {
  try {
    // Reference-image anchoring — resolve the scene's linked character's
    // OWN stored photo (never the previous scene's last frame). A scene
    // with no character (a b-roll/establishing shot, per film-storyboard.ts's
    // own characterSlotIndex: null case) has nothing to condition on and
    // generates text-only — expected, not a gap.
    let startImageAssetId: string | undefined;
    let scenePrompt = scene.videoPrompt ?? scene.prompt;
    if (scene.filmCharacterId) {
      const character = await prisma.filmCharacter.findUnique({ where: { id: scene.filmCharacterId } });
      const referenceAssetId = character ? resolveFilmCharacterReferenceAssetId(character) : null;
      if (referenceAssetId) {
        const referenceAsset = await prisma.asset.findFirst({ where: { id: referenceAssetId, status: "READY" } });
        if (referenceAsset) startImageAssetId = referenceAsset.id;
      }
      if (character?.characterSheet) {
        scenePrompt = appendCharacterSheetContext(scenePrompt, character.characterSheet);
      }
    }

    const result = await generateFilmSceneVideo({
      userId,
      videoProjectId: project.id,
      sceneId: scene.id,
      prompt: scenePrompt,
      aspectRatio: project.aspectRatio as "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9",
      durationSeconds: scene.durationSeconds,
      negativePrompt: scene.negativePrompt ?? undefined,
      startImageAssetId,
      preferredProviderId,
      spokenLine: scene.spokenLine,
    });

    // Real incident (2026-07-23) — a mock result must never be persisted as
    // a real success when nothing downstream re-checks it before the user
    // treats it as final (same standard as GENERATED's own fix and AI
    // Auto-Edit's transcription hard-fail).
    if (result.isMockFallback) {
      const message =
        "Scene generation used the placeholder provider, not a real one — no VIDEO provider (Veo) is currently enabled and reachable. Check Admin → AI Providers, then try again.";
      await prisma.scene.update({ where: { id: scene.id }, data: { status: "FAILED", errorMessage: message, ...CLEAR_RENDER_PROGRESS } });
      return { ok: false, code: "ERR_MOCK_FALLBACK", message, httpStatus: 502 };
    }

    const updated = await prisma.scene.update({
      where: { id: scene.id },
      // voiceKey (2026-07-25) — real ElevenLabs/edge_tts narration,
      // persisted so merge-via-editor.ts can actually composite it into the
      // final output (see that file's own real bug-fix comment). Null when
      // narration was requested but genuinely unavailable (see
      // narrationSkippedReason below) — the scene still completes with
      // real visuals rather than failing outright (2026-07-25 resilience
      // fix), so a null voiceKey here is an honest "no narration," not a
      // bug to chase.
      data: { status: "COMPLETED", videoKey: result.videoKey, voiceKey: result.voiceKey, errorMessage: null, ...CLEAR_RENDER_PROGRESS },
    });
    return {
      ok: true,
      scene: updated,
      creditsCharged: result.creditsCharged,
      providerId: result.providerId,
      narrationSkippedReason: result.narrationSkippedReason,
    };
  } catch (err) {
    // Real bug found live (2026-07-23, first real bulk-approve test run):
    // these three branches used to return without ever touching
    // scene.status. Harmless for the single-scene route on its own (a scene
    // that hit this simply kept whatever status it already had — DRAFT or
    // FAILED, both fine to retry), but the new bulk route marks every
    // targeted scene RENDERING up front before dispatching — so a scene
    // that failed here got stuck in RENDERING forever: invisible to the
    // user as anything but "still generating," and permanently blocking
    // BOTH the per-scene Retry button (disabled while RENDERING) and any
    // future bulk-approve run (its own "already in progress" guard treats
    // any RENDERING scene as a live run). Every failure path must leave a
    // scene in a real, retriable terminal state with a real error message.
    if (err instanceof InsufficientTierError) {
      await prisma.scene.update({ where: { id: scene.id }, data: { status: "FAILED", errorMessage: err.message, ...CLEAR_RENDER_PROGRESS } });
      return { ok: false, code: "ERR_TIER_REQUIRED", message: err.message, httpStatus: 403 };
    }
    if (err instanceof InsufficientCreditsError) {
      await prisma.scene.update({ where: { id: scene.id }, data: { status: "FAILED", errorMessage: err.message, ...CLEAR_RENDER_PROGRESS } });
      return { ok: false, code: "ERR_INSUFFICIENT_CREDITS", message: err.message, httpStatus: 402 };
    }
    if (err instanceof FilmSceneVideoError) {
      await prisma.scene.update({ where: { id: scene.id }, data: { status: "FAILED", errorMessage: err.message, ...CLEAR_RENDER_PROGRESS } });
      return { ok: false, code: "ERR_VALIDATION", message: err.message, httpStatus: 400 };
    }
    console.error(`generateAndPersistFilmScene failed for scene ${scene.id}`, err);
    const message = err instanceof Error ? err.message : "Scene generation failed.";
    await prisma.scene.update({ where: { id: scene.id }, data: { status: "FAILED", errorMessage: message, ...CLEAR_RENDER_PROGRESS } });
    return { ok: false, code: "ERR_INTERNAL", message, httpStatus: 500 };
  }
}
