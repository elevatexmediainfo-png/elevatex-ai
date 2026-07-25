import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getProjectWorkspace } from "@/lib/video-editor/projects";
import { listEditorAssets } from "@/lib/video-editor/assets";
import { verifyRenderToken } from "@/lib/video-editor/render-token";
import { resolveExportDimensions } from "@/lib/video-editor/export-engine";
import type { ClipTransform } from "@/lib/video-editor/transform";
import type { TransitionEasing } from "@/lib/video-editor/transition-engine";
import { RenderWorkspace } from "./render-workspace";

// Module 10 — headless render mode. No `auth()` session check: the
// headless-browser worker that navigates here has no logged-in user
// session (a fresh Playwright browser context isn't the user's browser),
// so it authenticates via a short-lived signed render token instead — see
// lib/video-editor/render-token.ts's file header for why. Not linked from
// anywhere in the live UI; reachable only by a worker holding a token
// minted for one specific, already-claimed EditorExport row.
export default async function EditorRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { projectId } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const verified = verifyRenderToken(token, projectId);
  if (!verified) notFound();

  const exportRow = await prisma.editorExport.findFirst({ where: { id: verified.exportId, projectId } });
  if (!exportRow) notFound();

  let workspace;
  try {
    workspace = await getProjectWorkspace(exportRow.userId, projectId);
  } catch {
    notFound();
  }

  const assetRows = await listEditorAssets(exportRow.userId, undefined);
  const assets = assetRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));

  const { widthPx, heightPx } = resolveExportDimensions(exportRow.resolution, workspace.project.widthPx, workspace.project.heightPx);

  // Export presets (2026-07-15) — same admin-configurable WATERMARK_TEXT
  // the legacy Milestone 9 editor's own watermark feature already reads
  // (lib/render/pipeline.ts), reused rather than a new config key. Only
  // resolved when this export actually requested it.
  const watermarkText = exportRow.watermark ? await getConfig("WATERMARK_TEXT") : null;

  return (
    <RenderWorkspace
      tracks={workspace.tracks}
      clips={workspace.clips.map((c) => ({
        ...c,
        content: c.content as Record<string, unknown> | null,
        transform: c.transform as ClipTransform | null,
      }))}
      transitions={workspace.transitions.map((t) => ({ ...t, easing: t.easing as unknown as TransitionEasing }))}
      assets={assets}
      widthPx={widthPx}
      heightPx={heightPx}
      watermarkText={watermarkText}
    />
  );
}
