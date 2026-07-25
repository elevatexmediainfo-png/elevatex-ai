import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getStorageProvider } from "@/lib/providers/storage";
import { ensureTimeline, listTimeline } from "@/lib/timeline/engine";
import { EditorClient } from "./editor-client";

// Video Editor (Milestone 9) — the post-render, multi-track compositing
// workspace: Timeline, Layers, Text/Caption editors, Scene Preview, Media
// Library, AI Editing, Export. Sits ADDITIVELY alongside the Studio
// (pre-render script/scene editing); both operate on the same VideoProject,
// neither one's data model depends on the other.
export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) notFound();

  // The Editor composites real scene artifacts — nothing to edit before a
  // script is confirmed into scenes. Pre-render editing stays in the Studio.
  if (project.status === "DRAFT" || project.status === "SCRIPT_READY") {
    redirect(`/videos/${id}/studio`);
  }

  const scenes = await prisma.scene.findMany({ where: { videoProjectId: id }, orderBy: { order: "asc" } });

  await ensureTimeline(id);
  const { tracks, clips } = await listTimeline(id);

  const storage = await getStorageProvider();
  const [fonts, textPresets, captionPresets, voices, music, stock] = await Promise.all([
    getConfig("AVAILABLE_FONTS"),
    getConfig("TEXT_STYLE_PRESETS"),
    getConfig("CAPTION_STYLE_PRESETS"),
    getConfig("AVAILABLE_VOICES"),
    getConfig("BACKGROUND_MUSIC_LIBRARY"),
    getConfig("STOCK_ASSET_LIBRARY"),
  ]);

  return (
    <EditorClient
      initialProject={{
        id: project.id,
        title: project.title,
        status: project.status,
        aspectRatio: project.aspectRatio,
        durationSeconds: project.durationSeconds,
      }}
      initialScenes={scenes.map((s) => ({
        id: s.id,
        order: s.order,
        status: s.status,
        prompt: s.prompt,
        imagePrompt: s.imagePrompt,
        videoPrompt: s.videoPrompt,
        durationSeconds: s.durationSeconds,
        videoUrl: s.videoKey ? storage.getPublicUrl(s.videoKey) : null,
        imageUrl: s.imageKey ? storage.getPublicUrl(s.imageKey) : null,
        voiceUrl: s.voiceKey ? storage.getPublicUrl(s.voiceKey) : null,
        backgroundMusicUrl: s.backgroundMusicUrl,
        subtitleText: s.subtitleText,
        errorMessage: s.errorMessage,
      }))}
      initialTracks={tracks}
      initialClips={clips.map((c) => ({ ...c, content: c.content as Record<string, unknown> | null }))}
      fonts={fonts}
      textPresets={textPresets}
      captionPresets={captionPresets}
      voices={voices}
      music={music}
      stock={stock}
    />
  );
}
