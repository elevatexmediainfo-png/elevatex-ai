import { prisma } from "@/lib/prisma";
import { videoBriefSchema } from "@/lib/validations/video";
import { parseFilmBrief } from "@/lib/film/types";
import { buildCommercialCreativeBrief, buildFilmCreativeBrief } from "./build-creative-brief";
import type { CreativeBrief } from "./types";

// Creative Brief layer's real entry point — the thin DB-fetching wrapper
// around the pure builders in build-creative-brief.ts (kept separate so
// those stay unit-testable without mocking Prisma). Mirrors this codebase's
// existing Director call-site pattern: a route/caller fetches the real rows,
// the actual logic takes plain data. Not wired into any route yet — per
// explicit instruction, Storyboard/Director/Compiler are untouched this pass.

export class CreativeBriefError extends Error {}

export async function getCreativeBrief(videoProjectId: string): Promise<CreativeBrief> {
  const project = await prisma.videoProject.findUnique({ where: { id: videoProjectId } });
  if (!project) {
    throw new CreativeBriefError(`VideoProject ${videoProjectId} not found.`);
  }

  const [profile, brandKit] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: project.userId } }),
    prisma.brandKit.findUnique({ where: { userId: project.userId } }),
  ]);

  if (project.sourceType === "FILM") {
    const filmBrief = parseFilmBrief(project.brief);
    return buildFilmCreativeBrief({
      videoProjectId: project.id,
      contentLanguage: project.contentLanguage,
      filmBrief,
      profile,
      brandKit,
    });
  }

  if (project.sourceType === "TALKING_HEAD_UPLOAD") {
    throw new CreativeBriefError(
      `VideoProject ${videoProjectId} is a TALKING_HEAD_UPLOAD project — it has no brief to build a Creative Brief from.`
    );
  }

  if (project.brief === null) {
    throw new CreativeBriefError(`VideoProject ${videoProjectId} has no brief recorded.`);
  }

  const parsedBrief = videoBriefSchema.parse(project.brief);
  return buildCommercialCreativeBrief({
    videoProjectId: project.id,
    contentLanguage: project.contentLanguage,
    objective: project.objective,
    brief: parsedBrief,
    profile,
    brandKit,
  });
}
