import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/shared/container";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { VideoDetailClient } from "./video-detail-client";

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    include: { template: { select: { name: true } } },
  });

  if (!project) notFound();

  // Milestone 8 — script editing, scene editing, and render confirmation all
  // moved into the Studio; this detail page is now purely the post-render
  // progress/result view.
  if (project.status === "DRAFT" || project.status === "SCRIPT_READY") {
    redirect(`/videos/${id}/studio`);
  }

  // Fixed 2026-07-19 — Talking Head's renderTalkingHeadScene() (lib/render/
  // pipeline.ts) already computes "was this scene's AI overlay a mock
  // fallback" to decide whether to bill it, but never persisted or surfaced
  // that anywhere, unlike Quick Video/Film Scene generation which both show
  // a "Placeholder preview — no credits charged" banner for the identical
  // situation. Rather than a schema migration to add a new Scene column,
  // this reuses the existing per-scene GenerationLog rows (Milestone 10
  // Part 8's cost-tracking table already records providerId + sceneId for
  // every scene_render/scene_image call) — no new persistence needed.
  const hasMockFallbackScenes =
    project.sourceType === "TALKING_HEAD_UPLOAD" &&
    (await prisma.generationLog.findFirst({
      where: {
        videoProjectId: project.id,
        providerId: MOCK_PROVIDER_ID,
        operation: { in: ["scene_render", "scene_image"] },
        status: "SUCCESS",
      },
      select: { id: true },
    })) != null;

  return (
    <Container className="flex max-w-2xl flex-col py-10">
      <VideoDetailClient
        initialProject={{
          id: project.id,
          title: project.title,
          status: project.status,
          generatedScript: project.generatedScript,
          previewVideoUrl: project.previewVideoUrl,
          previewThumbnailUrl: project.previewThumbnailUrl,
          durationSeconds: project.durationSeconds,
          errorMessage: project.errorMessage,
          creditCost: project.creditCost,
          sourceType: project.sourceType,
          templateName: project.template?.name ?? null,
          hasMockFallbackScenes,
        }}
      />
    </Container>
  );
}
