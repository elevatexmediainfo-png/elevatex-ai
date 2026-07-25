import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/admin/config";
import { getProjectWorkspace, touchLastOpened } from "@/lib/video-editor/projects";
import { listEditorAssets } from "@/lib/video-editor/assets";
import { InvalidStateError } from "@/lib/video-editor/errors";
import type { ClipTransform } from "@/lib/video-editor/transform";
import type { TransitionEasing } from "@/lib/video-editor/transition-engine";
import { EditorWorkspace } from "./editor-workspace";

// Cloud Video Editor workspace (Milestone 24) — the 6-region editor shell:
// Left Sidebar, Top Toolbar, Preview Window, Timeline, Right Properties
// Panel, Bottom Status Bar. Wholly separate data model/route from the
// existing AI editor at /videos/[id]/editor.
export default async function EditorProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { projectId } = await params;

  let workspace;
  try {
    workspace = await getProjectWorkspace(session.user.id, projectId);
  } catch (err) {
    if (err instanceof InvalidStateError) notFound();
    throw err;
  }

  await touchLastOpened(session.user.id, projectId);
  const [assetRows, snapThresholdPx, autosaveIntervalMs, versionSnapshotIntervalMs, versionSnapshotCommandInterval] = await Promise.all([
    listEditorAssets(session.user.id, undefined),
    getConfig("EDITOR_SNAP_THRESHOLD_PX"),
    getConfig("EDITOR_AUTOSAVE_INTERVAL_MS"),
    getConfig("EDITOR_VERSION_SNAPSHOT_INTERVAL_MS"),
    getConfig("EDITOR_VERSION_SNAPSHOT_COMMAND_INTERVAL"),
  ]);
  const assets = assetRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));

  return (
    <EditorWorkspace
      initialProject={{
        id: workspace.project.id,
        name: workspace.project.name,
        folderId: workspace.project.folderId,
        aspectRatio: workspace.project.aspectRatio,
        widthPx: workspace.project.widthPx,
        heightPx: workspace.project.heightPx,
        durationMs: workspace.project.durationMs,
        updatedAt: workspace.project.updatedAt.toISOString(),
        fps: workspace.project.fps,
      }}
      initialTracks={workspace.tracks}
      initialClips={workspace.clips.map((c) => ({
        ...c,
        content: c.content as Record<string, unknown> | null,
        transform: c.transform as ClipTransform | null,
      }))}
      initialMarkers={workspace.markers}
      initialTransitions={workspace.transitions.map((t) => ({ ...t, easing: t.easing as unknown as TransitionEasing }))}
      initialAssets={assets}
      snapThresholdPx={snapThresholdPx}
      autosaveIntervalMs={autosaveIntervalMs}
      versionSnapshotIntervalMs={versionSnapshotIntervalMs}
      versionSnapshotCommandInterval={versionSnapshotCommandInterval}
    />
  );
}
