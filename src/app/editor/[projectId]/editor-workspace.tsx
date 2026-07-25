"use client";

import type { CSSProperties } from "react";
import { EditorStoreProvider, useEditorStore } from "./store";
import { useEditorAssetsQuery, useEditorProjectQuery, type ProjectWorkspaceData } from "./queries";
import { useAutosave } from "./use-autosave";
import type { AssetView, ClipView, MarkerView, ProjectView, TrackView, TransitionView } from "../types";
import { TopToolbar } from "./top-toolbar";
import { CreativeStudioSidebar } from "./creative-studio-sidebar";
import { PreviewWindow } from "./preview-window";
import { TimelinePanel } from "./timeline-panel";
import { RightPropertiesPanel } from "./right-properties-panel";
import { BottomStatusBar } from "./bottom-status-bar";
import { CustomFontFaces } from "./custom-font-faces";
import { HorizontalPanelResizeHandle, VerticalPanelResizeHandle } from "./panel-resize-handle";

export function EditorWorkspace({
  initialProject,
  initialTracks,
  initialClips,
  initialMarkers,
  initialTransitions,
  initialAssets,
  snapThresholdPx,
  autosaveIntervalMs,
  versionSnapshotIntervalMs,
  versionSnapshotCommandInterval,
}: {
  initialProject: ProjectView;
  initialTracks: TrackView[];
  initialClips: ClipView[];
  initialMarkers: MarkerView[];
  initialTransitions: TransitionView[];
  initialAssets: AssetView[];
  snapThresholdPx: number;
  autosaveIntervalMs: number;
  versionSnapshotIntervalMs: number;
  versionSnapshotCommandInterval: number;
}) {
  return (
    <EditorStoreProvider snapThresholdPx={snapThresholdPx}>
      <WorkspaceBody
        projectId={initialProject.id}
        initialData={{ project: initialProject, tracks: initialTracks, clips: initialClips, markers: initialMarkers, transitions: initialTransitions }}
        initialAssets={initialAssets}
        autosaveIntervalMs={autosaveIntervalMs}
        versionSnapshotIntervalMs={versionSnapshotIntervalMs}
        versionSnapshotCommandInterval={versionSnapshotCommandInterval}
      />
    </EditorStoreProvider>
  );
}

function WorkspaceBody({
  projectId,
  initialData,
  initialAssets,
  autosaveIntervalMs,
  versionSnapshotIntervalMs,
  versionSnapshotCommandInterval,
}: {
  projectId: string;
  initialData: ProjectWorkspaceData;
  initialAssets: AssetView[];
  autosaveIntervalMs: number;
  versionSnapshotIntervalMs: number;
  versionSnapshotCommandInterval: number;
}) {
  // Seeds the React Query cache once at the workspace root — every panel
  // below calls the same hook (no initialData) and shares this cache entry.
  const { data } = useEditorProjectQuery(projectId, initialData);
  useEditorAssetsQuery(initialAssets);
  useAutosave(projectId, { autosaveIntervalMs, versionSnapshotIntervalMs, versionSnapshotCommandInterval });

  const project = data?.project ?? initialData.project;
  const tracks = data?.tracks ?? initialData.tracks;
  const clips = data?.clips ?? initialData.clips;
  const markers = data?.markers ?? initialData.markers;
  const transitions = data?.transitions ?? initialData.transitions;

  // Resizable panels (2026-07-15) — these three drive the CSS custom
  // properties creative-studio-sidebar/index.tsx, right-properties-
  // panel.tsx, and timeline-panel.tsx each read for their own width/
  // height. Set here (not just left to the drag handle's own direct DOM
  // writes) so the panels also pick up the committed value after a drag
  // ends and after the store's post-mount localStorage hydration — a
  // plain reactive subscription, not a manual DOM sync, for anything
  // that isn't the active drag gesture itself.
  const leftPanelWidth = useEditorStore((s) => s.leftPanelWidth);
  const rightPanelWidth = useEditorStore((s) => s.rightPanelWidth);
  const timelineHeight = useEditorStore((s) => s.timelineHeight);
  const panelSizeVars = {
    "--editor-left-panel-width": `${leftPanelWidth}px`,
    "--editor-right-panel-width": `${rightPanelWidth}px`,
    "--editor-timeline-height": `${timelineHeight}px`,
  } as CSSProperties;

  return (
    <div className="flex h-full flex-col" style={panelSizeVars}>
      <CustomFontFaces />
      <TopToolbar project={project} />
      {/* Timeline moved out of the Preview column (2026-07-14, full-spec
          audit) — a reference screenshot showed it spanning the FULL
          window width below Left/Preview/Right all three, not just under
          Preview; previously nested one level deeper here, constraining it
          to the Preview column's own width. Real layout rearrangement of
          existing real panels, not new functionality — Timeline's own
          internal sizing (pxPerSecond/duration-driven, not parent-width-
          driven) needed no changes to work correctly at the new width.

          `min-h-[460px]` added to this row (2026-07-14, real bug found via
          reproduction, not assumed) — Timeline's own `h-[420px]` was a
          fixed, non-shrinking-below-that demand on the outer column's
          height; on any real laptop-scale window (confirmed live at
          1366×768 and 1280×720, both common resolutions, not edge cases)
          this row had almost nothing left and collapsed the Preview stage
          to as little as 50×90px and clipped the Right Panel's empty-state
          description text mid-sentence — reproduced and measured directly,
          not inferred from the report alone. This floor guarantees the
          stage and Properties panel always have enough room to render
          fully; TimelinePanel's own `min-h-[180px]` (see its file) is the
          matching floor on the other side, so on a genuinely short window
          Timeline shrinks first, down to a still-usable size, rather than
          Preview being crushed to a thumbnail. */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-[460px] flex-1 overflow-hidden">
          <CreativeStudioSidebar />
          {/* Grows the Left Panel when dragged right — default (no invert).
              Hidden below `lg` alongside the panel it drags (D1, 2026-07-22)
              — nothing to resize once that panel isn't rendered. */}
          <VerticalPanelResizeHandle sizeKey="leftPanelWidth" className="hidden lg:block" />
          <div className="flex flex-1 flex-col overflow-hidden">
            <PreviewWindow projectId={projectId} project={project} tracks={tracks} clips={clips} transitions={transitions} />
          </div>
          {/* Shrinks the Right Panel when dragged right — inverted, since
              this handle sits to the panel's OWN left (moving right gives
              Preview more room, Right Panel less). Hidden below `lg`, same
              reason as the left handle above. */}
          <VerticalPanelResizeHandle sizeKey="rightPanelWidth" invert className="hidden lg:block" />
          <RightPropertiesPanel projectId={projectId} clips={clips} tracks={tracks} transitions={transitions} />
        </div>
        {/* Grows the Timeline when dragged UP — inverted, since a negative
            clientY delta (dragging up) should map to a POSITIVE height
            delta for the panel below this handle. */}
        <HorizontalPanelResizeHandle sizeKey="timelineHeight" invert />
        <TimelinePanel projectId={projectId} tracks={tracks} clips={clips} markers={markers} transitions={transitions} />
      </div>
      <BottomStatusBar project={project} />
    </div>
  );
}
