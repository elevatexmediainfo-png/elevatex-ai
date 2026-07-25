import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFolders } from "@/lib/video-editor/folders";
import { listProjects } from "@/lib/video-editor/projects";
import { ProjectBrowser } from "./project-browser";

// Cloud Video Editor — Project Browser (Milestone 24). The landing page of
// the standalone, non-AI editor module: folders + projects, independent of
// every AI Scene/VideoProject concept elsewhere in this app.
export default async function EditorHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // B4 Phase 3 (2026-07-22) — "AI Studio" and "Talking Head" were removed
  // as separate top-level sidebar entries (both drove the legacy
  // VideoProject/Track/Clip model exclusively — see dashboard-nav-items.ts).
  // Their one real job, letting a user find/resume an existing legacy
  // project, is preserved here as a "Legacy videos" tab rather than a
  // second page — a superset of both old lists (any sourceType, any
  // status) so nothing that used to be reachable becomes unreachable.
  // Deliberately NOT a full migration: these rows stay on the old
  // Track/Clip model and route back into the old /videos/[id] flow, which
  // already smart-routes DRAFT/SCRIPT_READY projects to /studio and
  // everything else to the post-render detail view.
  const [folders, projects, legacyProjects] = await Promise.all([
    listFolders(session.user.id),
    listProjects(session.user.id),
    prisma.videoProject.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true, sourceType: true, updatedAt: true },
    }),
  ]);

  return (
    <ProjectBrowser
      initialFolders={folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
      initialProjects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        folderId: p.folderId,
        aspectRatio: p.aspectRatio,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
        durationMs: p.durationMs,
        updatedAt: p.updatedAt.toISOString(),
        fps: p.fps,
      }))}
      legacyProjects={legacyProjects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        sourceType: p.sourceType,
        updatedAt: p.updatedAt.toISOString(),
      }))}
    />
  );
}
