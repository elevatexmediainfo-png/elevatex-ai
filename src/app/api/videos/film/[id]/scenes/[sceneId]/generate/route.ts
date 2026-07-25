import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireOwnedFilmProject } from "@/lib/film/access";
import { generateAndPersistFilmScene } from "@/lib/film/generate-scene";

// POST /api/videos/film/[id]/scenes/[sceneId]/generate — the per-scene video
// generation step. Wired for real (2026-07-12), replacing the earlier
// honest structural stub now that the conditioning METHOD is a settled
// founder decision: reference-image anchoring (Variant B) — every scene of
// a character conditions on that character's OWN stored photo
// (resolveFilmCharacterReferenceAssetId(), the same real resolution the
// stub already proved live), never a chained previous-scene frame. The
// character sheet's text supplements the scene prompt (appendCharacterSheetContext())
// but is never the consistency mechanism itself — the photo, passed as
// VideoRenderRequest.startImage, is. generateFilmSceneVideo() mirrors
// generateVeoLiteVideo()'s exact proven shape: tier/credit precheck,
// charge-after-success, never-bill-a-mock-fallback guard, pacing/failover/
// retry all inherited for free from the Generation Engine.
//
// 2026-07-23 — the actual generation/persistence logic moved to
// generateAndPersistFilmScene() (lib/film/generate-scene.ts) so the new
// bulk "Approve storyboard & generate all scenes" action can reuse it
// exactly rather than re-deriving it; this route is now just that
// function's result mapped onto an HTTP response.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  const project = await requireOwnedFilmProject(session.user.id, id);
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
  }

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, videoProjectId: id } });
  if (!scene) {
    return apiError("ERR_NOT_FOUND", "Scene not found.", 404);
  }

  // Real bug fix (2026-07-24, found live during the codebase health check) —
  // this route had no concurrency guard at all: a double-click (or two
  // tabs) both pass the same `scene` snapshot straight into
  // generateAndPersistFilmScene(), firing two real Veo calls and two real
  // consumeCredits() charges for one logical action, with the second
  // scene.update() silently overwriting the first's videoKey (an orphaned,
  // paid-for clip). Same bug class as the PAYMENT mock-exploit fix earlier
  // this session, and the exact fix scenes/generate-all/route.ts already
  // has (mark RENDERING before dispatching) — just never applied here.
  // A conditional `updateMany` is a single atomic UPDATE...WHERE (same
  // "claim" pattern as exports.ts's claimNextExport()), so only one of two
  // truly concurrent requests can ever flip count to 1 — the loser gets a
  // clean 409, not a second real generation call. Regenerating an already-
  // COMPLETED scene is a deliberate, supported action (see
  // SceneGenerateButton's own comment), so the only status excluded from
  // the claim is RENDERING itself.
  const claimed = await prisma.scene.updateMany({
    where: { id: scene.id, status: { not: "RENDERING" } },
    data: { status: "RENDERING", errorMessage: null },
  });
  if (claimed.count === 0) {
    return apiError("ERR_INVALID_STATE", "This scene is already generating.", 409);
  }

  const body = await req.json().catch(() => ({}));
  const preferredProviderId = typeof body.preferredProviderId === "string" ? body.preferredProviderId : undefined;

  const result = await generateAndPersistFilmScene(session.user.id, project, scene, preferredProviderId);
  if (!result.ok) {
    return apiError(result.code, result.message, result.httpStatus);
  }
  return apiSuccess({
    scene: result.scene,
    creditsCharged: result.creditsCharged,
    providerId: result.providerId,
    // Real-resilience signal (2026-07-25) — non-null when the scene had a
    // spokenLine but no real VOICE provider could produce it, so the client
    // can show an honest "narration unavailable" toast instead of silently
    // treating a voice-less scene as fully successful with nothing said.
    narrationSkippedReason: result.narrationSkippedReason,
  });
}
