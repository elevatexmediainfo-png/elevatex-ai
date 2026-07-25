import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";

// Timeline markers (Module 2) — a minimal slice: time position only, no
// label/color yet (see the EditorMarker schema comment). Exists so magnetic
// snap has a real third target type to snap to, alongside clip edges and
// the playhead.

export async function addMarker(projectId: string, timeMs: number) {
  return prisma.editorMarker.create({ data: { projectId, timeMs } });
}

export async function listMarkers(projectId: string) {
  return prisma.editorMarker.findMany({ where: { projectId }, orderBy: { timeMs: "asc" } });
}

export async function removeMarker(projectId: string, markerId: string): Promise<void> {
  const claim = await prisma.editorMarker.deleteMany({ where: { id: markerId, projectId } });
  if (claim.count === 0) throw new InvalidStateError("Marker not found in this project.");
}
