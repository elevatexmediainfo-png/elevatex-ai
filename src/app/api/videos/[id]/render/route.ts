import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getConfig } from "@/lib/admin/config";
import { enqueueRenderableScenes } from "@/lib/scenes/engine";
import { checkVideoActionAccess, InsufficientTierError } from "@/lib/credits/video-actions";

// Marks a request that lost the race to be the one that transitions this
// project out of SCRIPT_READY (e.g. a double-click, or two tabs both
// confirming the same script).
class AlreadyProcessedError extends Error {}

// POST /api/videos/[id]/render — confirms the script and enqueues one
// RenderJob per scene so they render independently/in parallel. Milestone 8:
// scenes already exist by this point (created right after script generation
// — see app/api/videos/route.ts — and editable in the Studio's Scene Editor
// until now), so this route's only job is the atomic status claim + enqueue.
// Milestone 4: rendering itself used to be free and unlimited (only
// downloading the finished master cost credits — see lib/downloads/). No
// longer true: each scene now charges real per-scene credits at render time
// (see lib/render/pipeline.ts's own "credit-model switch" comment) — this
// route still doesn't touch CreditAccount directly (that happens per-scene,
// deeper in the pipeline), but it DOES gate access to the multi-scene ad
// feature itself before any scene is even queued (see the PRO-tier check
// below), since that gate was previously only wired into dead code
// (lib/creative/veo-multiscene-video.ts, never called from this live path).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const preferredVideoProviderId = typeof body.preferredProviderId === "string" ? body.preferredProviderId : null;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    include: { _count: { select: { scenes: true } }, template: { select: { useSceneSplit: true } } },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }
  if (project.status !== "SCRIPT_READY") {
    return apiError(
      "ERR_INVALID_STATE",
      "This video has already been queued, rendered, or cancelled.",
      409
    );
  }
  // Milestone 11 — a Talking Head project has no generatedScript (its
  // "script" is the uploaded video's transcript); this check only applies
  // to the GENERATED flow.
  if (project.sourceType === "GENERATED" && !project.generatedScript) {
    return apiError("ERR_INVALID_STATE", "No script to render.", 409);
  }
  if (project._count.scenes === 0) {
    return apiError("ERR_INVALID_STATE", "Add at least one scene before rendering.", 409);
  }

  // Fixed 2026-07-19 — the PRO-tier gate on multi-scene ads (documented in
  // VIDEO_ACTION_CREDIT_COSTS.veo_multiscene_ad) was never enforced on this
  // live path; a BASIC-tier user could generate one uncontrolled. Checked
  // once, before the scene loop starts (not per-scene) — a real multi-scene
  // ad is any scene-split template producing more than one scene.
  if (project.template?.useSceneSplit && project._count.scenes > 1) {
    try {
      await checkVideoActionAccess(session.user.id, "veo_multiscene_ad");
    } catch (err) {
      if (err instanceof InsufficientTierError) {
        return apiError("ERR_INSUFFICIENT_TIER", err.message, 403);
      }
      throw err;
    }
  }

  const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");

  try {
    // Claim + enqueue together. The claim is an atomic conditional UPDATE
    // (status must still be SCRIPT_READY) — without it, two concurrent
    // requests for the same project (double-click, two tabs) would both pass
    // the earlier status check and enqueue render jobs twice.
    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.videoProject.updateMany({
        where: { id: project.id, status: "SCRIPT_READY" },
        data: { status: "QUEUED", preferredVideoProviderId },
      });
      if (claim.count === 0) {
        throw new AlreadyProcessedError();
      }

      await enqueueRenderableScenes(project.id, maxAttempts, tx);

      return tx.videoProject.findUniqueOrThrow({ where: { id: project.id } });
    });

    return apiSuccess({ project: updated });
  } catch (err) {
    if (err instanceof AlreadyProcessedError) {
      return apiError(
        "ERR_INVALID_STATE",
        "This video has already been queued, rendered, or cancelled.",
        409
      );
    }
    throw err;
  }
}
