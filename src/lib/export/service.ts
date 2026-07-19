import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";

// Export System (Milestone 9) — creating an Export used to just create a row
// plus a tagged RenderJob; the actual compositing happens in
// lib/render/pipeline.ts's processExportJob(), reusing the EXACT existing
// RenderJob queue (claimNextJob/completeJob/failJob) rather than a second
// queue. `payload.kind: "export"` is the dispatch tag pipeline.ts checks
// before falling back to its original scene/merge branches.

export class InvalidStateError extends Error {}

// Fixed 2026-07-19 — createExport() disabled. processExportJob() composites
// via composeTimeline(), which every real VideoProvider deliberately throws
// on (no vendor offers a generic scene-merge capability) — meaning this
// path can currently only ever produce MockVideoProvider's canned
// placeholder, never the user's real content. Blocked here, before any
// credit is charged (TALKING_HEAD_UPLOAD's exportCredits) or job is queued,
// rather than silently billing for and delivering a guaranteed-wrong video.
// The real, working export for any project already exists via the
// automatic real merge that runs after scene rendering (mergeScenesViaEditor,
// through the Cloud Video Editor's own Export Engine) — this manual Export
// panel was always a separate, now-redundant path. Re-enable by restoring
// the row-create + RenderJob-enqueue logic (git history has it) once
// composeTimeline() has a real per-provider implementation.
export class ExportUnavailableError extends Error {}

export interface CreateExportInput {
  resolution: "R720P" | "R1080P" | "R4K";
  codec: "H264" | "H265" | "VP9";
  watermark: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature kept stable for its one caller; see the disabled-not-deleted note above.
export async function createExport(videoProjectId: string, userId: string, input: CreateExportInput) {
  throw new ExportUnavailableError(
    "This export path is temporarily unavailable — it can currently only produce a placeholder video. A real, downloadable version of this video is already available from its video page."
  );
}

export async function listExports(videoProjectId: string, userId: string) {
  const project = await prisma.videoProject.findFirst({ where: { id: videoProjectId, userId } });
  if (!project) throw new InvalidStateError("Video project not found.");

  const storage = await getStorageProvider();
  const rows = await prisma.export.findMany({ where: { videoProjectId }, orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({ ...row, url: row.outputKey ? storage.getPublicUrl(row.outputKey) : null }));
}

export async function getExport(videoProjectId: string, userId: string, exportId: string) {
  const project = await prisma.videoProject.findFirst({ where: { id: videoProjectId, userId } });
  if (!project) throw new InvalidStateError("Video project not found.");

  const exportRow = await prisma.export.findFirst({ where: { id: exportId, videoProjectId } });
  if (!exportRow) throw new InvalidStateError("Export not found.");

  const storage = await getStorageProvider();
  return { ...exportRow, url: exportRow.outputKey ? storage.getPublicUrl(exportRow.outputKey) : null };
}
