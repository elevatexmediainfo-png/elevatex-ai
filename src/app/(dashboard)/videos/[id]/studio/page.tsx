import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { listScenes } from "@/lib/scenes/engine";
import { StudioClient } from "./studio-client";
import { VisualPlanReviewClient } from "./visual-plan-review-client";

// AI Content Studio (Milestone 8) — the pre-render workspace: Script Studio,
// Scene Editor, Asset Library, and Version History. Only meaningful while a
// project is DRAFT/SCRIPT_READY (scenes are still DRAFT and freely editable);
// once render is confirmed, /videos/[id] takes over as the progress/result
// view, so this page redirects there for any later status.
export default async function StudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    include: { template: { select: { name: true, durationSeconds: true, aspectRatio: true } } },
  });
  if (!project) notFound();

  if (project.status !== "DRAFT" && project.status !== "SCRIPT_READY") {
    redirect(`/videos/${id}`);
  }

  // Milestone 11 — Talking Head projects review an AI-generated VISUAL
  // PLAN (per-scene visual type + asset/cost preview), not an AI-generated
  // SCRIPT. Same route, same DRAFT/SCRIPT_READY gate above, same eventual
  // "confirm and render" action (POST .../render) — only the review UI
  // differs, since there's no script/brief/Prompt Studio for this flow.
  if (project.sourceType === "TALKING_HEAD_UPLOAD") {
    const [scenes, transcript] = await Promise.all([
      prisma.scene.findMany({
        where: { videoProjectId: id },
        orderBy: { order: "asc" },
        include: { transcriptSegments: { select: { analysis: true } } },
      }),
      prisma.transcript.findUnique({ where: { videoProjectId: id }, select: { providerId: true } }),
    ]);

    return (
      <VisualPlanReviewClient
        initialProject={{
          id: project.id,
          title: project.title,
          status: project.status,
          errorMessage: project.errorMessage,
          isMockTranscript: transcript?.providerId === MOCK_PROVIDER_ID,
        }}
        initialScenes={scenes.map((s) => ({
          id: s.id,
          order: s.order,
          prompt: s.prompt,
          visualType: s.visualType,
          durationSeconds: s.durationSeconds,
          tags: Array.from(
            new Set(
              s.transcriptSegments.flatMap((seg) => (seg.analysis as { tags?: string[] } | null)?.tags ?? [])
            )
          ),
          isHook: s.transcriptSegments.some((seg) => (seg.analysis as { isHook?: boolean } | null)?.isHook),
          isCTA: s.transcriptSegments.some((seg) => (seg.analysis as { isCTA?: boolean } | null)?.isCTA),
        }))}
      />
    );
  }

  const [scenes, availableVoices, musicLibrary, videoActionCredits] = await Promise.all([
    listScenes(id),
    getConfig("AVAILABLE_VOICES"),
    getConfig("BACKGROUND_MUSIC_LIBRARY"),
    getConfig("VIDEO_ACTION_CREDIT_COSTS"),
  ]);

  // Real cost estimate — replaces the stale, always-1 Template.creditCost
  // field (see lib/render/pipeline.ts's own comment on the credit-model
  // switch: rendering now charges per-scene at real veo_lite cost, not a
  // flat project-level fee). Sourced from the same admin-configurable
  // VIDEO_ACTION_CREDIT_COSTS.veo_lite record the actual charge reads at
  // render time, so this estimate can never drift from what's really billed.
  const perSceneCredits = videoActionCredits.veo_lite?.credits ?? 0;

  return (
    <StudioClient
      initialProject={{
        id: project.id,
        title: project.title,
        status: project.status,
        generatedScript: project.generatedScript,
        contentLanguage: project.contentLanguage,
        perSceneCredits,
        templateName: project.template?.name ?? null,
        templateDurationSeconds: project.template?.durationSeconds ?? null,
        thumbnailSceneId: project.thumbnailSceneId,
      }}
      initialScenes={scenes.map((s) => ({
        id: s.id,
        order: s.order,
        status: s.status,
        prompt: s.prompt,
        imagePrompt: s.imagePrompt,
        videoPrompt: s.videoPrompt,
        negativePrompt: s.negativePrompt,
        subtitleText: s.subtitleText,
        durationSeconds: s.durationSeconds,
        transition: s.transition,
        voiceId: s.voiceId,
        backgroundMusicUrl: s.backgroundMusicUrl,
        errorMessage: s.errorMessage,
      }))}
      availableVoices={availableVoices}
      musicLibrary={musicLibrary}
    />
  );
}
