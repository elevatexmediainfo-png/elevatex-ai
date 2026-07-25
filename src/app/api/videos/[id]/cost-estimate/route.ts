import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getConfig } from "@/lib/admin/config";
import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { resolveSceneAsset } from "@/lib/talking-head/asset-selector";
import { estimateProjectCost, type SceneCostInput } from "@/lib/talking-head/cost-estimator";

// GET /api/videos/[id]/cost-estimate — Milestone 11 Part 11. Runs the EXACT
// same Intelligent Asset Selector decisions render time would (no separate
// "preview waterfall"), totals them with estimateProjectCost(), and returns
// the bill before any paid generation happens — free, no credits touched,
// matching Part 12's confirmed boundary.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }
  if (project.sourceType !== "TALKING_HEAD_UPLOAD") {
    return apiError("ERR_VALIDATION", "Cost estimates apply only to Talking Head projects.", 400);
  }

  const scenes = await prisma.scene.findMany({ where: { videoProjectId: id }, orderBy: { order: "asc" } });

  const [creditRates, vendorRates, imagePriority, videoPriority] = await Promise.all([
    getConfig("TALKING_HEAD_CREDIT_COSTS"),
    getConfig("GENERATION_COST_RATES"),
    listEnabledProviderConfigs("IMAGE"),
    listEnabledProviderConfigs("VIDEO"),
  ]);

  const sceneInputs: SceneCostInput[] = await Promise.all(
    scenes.map(async (scene) => ({
      sceneId: scene.id,
      durationSeconds: scene.durationSeconds,
      decision: await resolveSceneAsset(scene, project),
    }))
  );

  const estimate = estimateProjectCost(sceneInputs, creditRates, {
    image: vendorRates[imagePriority[0]],
    video: vendorRates[videoPriority[0]],
  });

  return apiSuccess({ estimate });
}
