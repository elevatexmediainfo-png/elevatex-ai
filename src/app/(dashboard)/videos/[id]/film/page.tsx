import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { parseFilmBrief } from "@/lib/film/types";
import { FilmFlowClient } from "./film-flow-client";

// AI Film flow hub (2026-07-12 generation-free build). One page, one client
// component that decides which of the founder's 6 screens to show next
// (character selection -> character sheet -> storyboard -> per-scene
// generation -> merge -> done) purely from what's already in the database —
// same "server holds the truth, client just renders the current state"
// pattern /videos/[id]/studio already uses. Mirrors that page's server/client
// split exactly: this component only fetches + resolves asset URLs, all
// interactivity lives in film-flow-client.tsx.
export default async function FilmFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id } });
  if (!project || project.sourceType !== "FILM") notFound();

  const [characters, scenes] = await Promise.all([
    prisma.filmCharacter.findMany({ where: { videoProjectId: id }, orderBy: { slotIndex: "asc" } }),
    prisma.scene.findMany({ where: { videoProjectId: id }, orderBy: { order: "asc" } }),
  ]);

  const assetIds = new Set<string>();
  for (const c of characters) {
    for (const a of (c.variationAssetIds as string[] | null) ?? []) assetIds.add(a);
    if (c.selectedVariationAssetId) assetIds.add(c.selectedVariationAssetId);
    if (c.faceUploadSideAssetId) assetIds.add(c.faceUploadSideAssetId);
    if (c.faceUploadFrontAssetId) assetIds.add(c.faceUploadFrontAssetId);
  }

  const storage = await getStorageProvider();
  const assets = assetIds.size
    ? await prisma.asset.findMany({ where: { id: { in: Array.from(assetIds) } } })
    : [];
  const assetUrlById = Object.fromEntries(assets.map((a) => [a.id, storage.getPublicUrl(a.storageKey)]));

  return (
    <FilmFlowClient
      project={{
        id: project.id,
        title: project.title,
        status: project.status,
        aspectRatio: project.aspectRatio,
        brief: parseFilmBrief(project.brief),
        previewVideoUrl: project.previewVideoUrl,
      }}
      characters={characters.map((c) => ({
        id: c.id,
        slotIndex: c.slotIndex,
        name: c.name,
        variationAssetIds: (c.variationAssetIds as string[] | null) ?? [],
        selectedVariationAssetId: c.selectedVariationAssetId,
        faceUploadSideAssetId: c.faceUploadSideAssetId,
        faceUploadFrontAssetId: c.faceUploadFrontAssetId,
        characterSheet: c.characterSheet as Record<string, string> | null,
        status: c.status,
      }))}
      scenes={scenes.map((s) => ({
        id: s.id,
        order: s.order,
        prompt: s.prompt,
        durationSeconds: s.durationSeconds,
        status: s.status,
        filmCharacterId: s.filmCharacterId,
        errorMessage: s.errorMessage,
        // Scene generation (2026-07-12) — a real clip once COMPLETED, so the
        // Scenes screen can preview it directly instead of jumping straight
        // to Merge before the founder has actually looked at any of them.
        videoUrl: s.videoKey ? storage.getPublicUrl(s.videoKey) : null,
        // Storyboard preview image (2026-07-24) — a real, cheap image shown
        // BEFORE the user commits to the expensive video render. Null when
        // generation degraded gracefully (real provider outage, etc.) —
        // the UI falls back to text-only for that scene, same as before
        // this feature existed.
        previewImageUrl: s.previewImageKey ? storage.getPublicUrl(s.previewImageKey) : null,
      }))}
      assetUrlById={assetUrlById}
    />
  );
}
