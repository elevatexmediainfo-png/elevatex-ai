"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoStatusBadge } from "@/components/shared/video-status-badge";
import {
  EditorContext,
  TRACK_KINDS,
  clipEndMs,
  type AssetView,
  type ClipContent,
  type ClipView,
  type EditorContextValue,
  type FontOption,
  type MusicOption,
  type ProjectView,
  type RightPanelTab,
  type SceneView,
  type StockOption,
  type StylePreset,
  type TrackKind,
  type TrackView,
  type VoiceOption,
} from "./editor-types";
import { ScenePreview } from "./scene-preview";
import { Timeline } from "./timeline";
import { LayersPanel } from "./layers-panel";
import { TextEditorPanel } from "./text-editor-panel";
import { MotionEditorPanel } from "./motion-editor-panel";
import { CaptionEditorPanel } from "./caption-editor-panel";
import { MediaLibraryPanel } from "./media-library-panel";
import { AiEditingPanel } from "./ai-editing-panel";
import { ExportPanel } from "./export-panel";
import { CreativeStudioSidebar } from "@/components/creative/creative-studio-sidebar";

async function api<T>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Something went wrong.");
      return { ok: false };
    }
    return { ok: true, data: json.data as T };
  } catch {
    toast.error("Network error. Please try again.");
    return { ok: false };
  }
}

export function EditorClient({
  initialProject,
  initialScenes,
  initialTracks,
  initialClips,
  fonts,
  textPresets,
  captionPresets,
  voices,
  music,
  stock,
}: {
  initialProject: ProjectView;
  initialScenes: SceneView[];
  initialTracks: TrackView[];
  initialClips: ClipView[];
  fonts: FontOption[];
  textPresets: StylePreset[];
  captionPresets: StylePreset[];
  voices: VoiceOption[];
  music: MusicOption[];
  stock: StockOption[];
}) {
  const [scenes, setScenes] = React.useState(initialScenes);
  const [tracks, setTracks] = React.useState(initialTracks);
  const [clips, setClips] = React.useState(initialClips);
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(null);
  const [playheadMs, setPlayheadMs] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [pxPerSecond, setPxPerSecond] = React.useState(40);
  const [rightTab, setRightTab] = React.useState<RightPanelTab>("layers");
  const [assets, setAssets] = React.useState<AssetView[]>([]);

  const project = initialProject;

  const patchScene = React.useCallback((sceneId: string, patch: Partial<SceneView>) => {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)));
  }, []);

  const refreshAssets = React.useCallback(() => {
    fetch("/api/assets")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setAssets(json.data.assets);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshAssets();
  }, [refreshAssets]);

  const refreshTimeline = React.useCallback(async () => {
    const result = await api<{ tracks: TrackView[]; clips: ClipView[] }>(`/api/videos/${project.id}/timeline`, "GET");
    if (result.ok) {
      setTracks(result.data.tracks);
      setClips(result.data.clips.map((c) => ({ ...c, content: (c.content as ClipContent | null) ?? null })));
    }
  }, [project.id]);

  const addTrack = React.useCallback(
    async (kind: TrackKind) => {
      const result = await api<{ track: TrackView }>(`/api/videos/${project.id}/timeline/tracks`, "POST", { kind });
      if (!result.ok) return null;
      setTracks((prev) => [...prev, result.data.track]);
      return result.data.track;
    },
    [project.id]
  );

  const removeTrack = React.useCallback(
    async (trackId: string) => {
      const result = await api(`/api/videos/${project.id}/timeline/tracks/${trackId}`, "DELETE");
      if (result.ok) {
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        setClips((prev) => prev.filter((c) => c.trackId !== trackId));
      }
    },
    [project.id]
  );

  const updateTrack = React.useCallback(
    async (trackId: string, patch: { isMuted?: boolean; isHidden?: boolean }) => {
      const result = await api<{ track: TrackView }>(`/api/videos/${project.id}/timeline/tracks/${trackId}`, "PATCH", patch);
      if (result.ok) setTracks((prev) => prev.map((t) => (t.id === trackId ? result.data.track : t)));
    },
    [project.id]
  );

  const moveTrack = React.useCallback(
    async (trackId: string, direction: "UP" | "DOWN") => {
      const result = await api<{ tracks: TrackView[] }>(
        `/api/videos/${project.id}/timeline/tracks/${trackId}/move`,
        "POST",
        { direction }
      );
      if (result.ok) setTracks(result.data.tracks);
    },
    [project.id]
  );

  const addClip = React.useCallback(
    async (input: {
      trackId: string;
      sceneId?: string;
      assetId?: string;
      startMs: number;
      durationMs: number;
      content?: ClipContent;
    }) => {
      const result = await api<{ clip: ClipView }>(`/api/videos/${project.id}/timeline/clips`, "POST", input);
      if (!result.ok) return null;
      setClips((prev) => [...prev, result.data.clip]);
      return result.data.clip;
    },
    [project.id]
  );

  const updateClip = React.useCallback(
    async (
      clipId: string,
      patch: Partial<Pick<ClipView, "trackId" | "startMs" | "durationMs" | "trimStartMs" | "content">>
    ) => {
      const result = await api<{ clip: ClipView }>(`/api/videos/${project.id}/timeline/clips/${clipId}`, "PATCH", patch);
      if (result.ok) setClips((prev) => prev.map((c) => (c.id === clipId ? result.data.clip : c)));
    },
    [project.id]
  );

  const deleteClip = React.useCallback(
    async (clipId: string) => {
      const result = await api(`/api/videos/${project.id}/timeline/clips/${clipId}`, "DELETE");
      if (result.ok) {
        setClips((prev) => prev.filter((c) => c.id !== clipId));
        setSelectedClipId((id) => (id === clipId ? null : id));
      }
    },
    [project.id]
  );

  const splitClip = React.useCallback(
    async (clipId: string, offsetMs: number) => {
      const result = await api(`/api/videos/${project.id}/timeline/clips/${clipId}/split`, "POST", { offsetMs });
      if (result.ok) await refreshTimeline();
    },
    [project.id, refreshTimeline]
  );

  const mergeClips = React.useCallback(
    async (clipId: string, withClipId: string) => {
      const result = await api(`/api/videos/${project.id}/timeline/clips/merge`, "POST", { clipId, withClipId });
      if (result.ok) {
        await refreshTimeline();
        setSelectedClipId(null);
      }
    },
    [project.id, refreshTimeline]
  );

  const duplicateClip = React.useCallback(
    async (clipId: string) => {
      const result = await api(`/api/videos/${project.id}/timeline/clips/${clipId}/duplicate`, "POST");
      if (result.ok) await refreshTimeline();
    },
    [project.id, refreshTimeline]
  );

  const sceneById = React.useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes]);
  const assetById = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const totalDurationMs = React.useMemo(
    () => clips.reduce((max, c) => Math.max(max, clipEndMs(c)), 0),
    [clips]
  );

  // Keyboard shortcuts — ignored while typing in a form field so they don't
  // hijack normal text editing in the Text/Caption panels.
  React.useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlayheadMs((ms) => Math.max(0, ms - (e.shiftKey ? 1000 : 100)));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlayheadMs((ms) => Math.min(totalDurationMs, ms + (e.shiftKey ? 1000 : 100)));
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        e.preventDefault();
        void deleteClip(selectedClipId);
      } else if (e.key === "s" && selectedClipId) {
        const clip = clips.find((c) => c.id === selectedClipId);
        if (clip && playheadMs > clip.startMs && playheadMs < clipEndMs(clip)) {
          e.preventDefault();
          void splitClip(selectedClipId, playheadMs - clip.startMs);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedClipId) {
        e.preventDefault();
        void duplicateClip(selectedClipId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedClipId, playheadMs, clips, totalDurationMs, deleteClip, splitClip, duplicateClip]);

  const contextValue: EditorContextValue = {
    project,
    scenes,
    patchScene,
    tracks,
    clips,
    selectedClipId,
    setSelectedClipId,
    playheadMs,
    setPlayheadMs,
    playing,
    setPlaying,
    pxPerSecond,
    setPxPerSecond,
    rightTab,
    setRightTab,
    fonts,
    textPresets,
    captionPresets,
    voices,
    music,
    stock,
    assets,
    refreshAssets,
    addTrack,
    removeTrack,
    updateTrack,
    moveTrack,
    addClip,
    updateClip,
    deleteClip,
    splitClip,
    mergeClips,
    duplicateClip,
    sceneById,
    assetById,
    totalDurationMs,
  };

  return (
    <EditorContext.Provider value={contextValue}>
      <div className="flex h-[calc(100vh-0px)] min-h-screen flex-col bg-neutral-50">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3 overflow-hidden">
            <Link
              href={`/videos/${project.id}`}
              className="inline-flex shrink-0 items-center gap-1.5 text-label-sm text-neutral-500 hover:text-neutral-900"
            >
              <ArrowLeft className="size-4" /> Back
            </Link>
            <h1 className="truncate text-label-lg text-neutral-900">{project.title}</h1>
            <VideoStatusBadge status={project.status} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row md:p-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4 md:max-w-[28rem]">
            <CreativeStudioSidebar />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <ScenePreview />
            <Timeline />
          </div>

          <div className="w-full shrink-0 overflow-y-auto rounded-xl border border-neutral-200 bg-white md:w-96">
            <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as RightPanelTab)}>
              <TabsList variant="line" className="w-full overflow-x-auto px-2">
                <TabsTrigger value="layers">Layers</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="motion">Motion</TabsTrigger>
                <TabsTrigger value="captions">Captions</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="ai">AI Edit</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              <div className="p-4">
                <TabsContent value="layers">
                  <LayersPanel />
                </TabsContent>
                <TabsContent value="text">
                  <TextEditorPanel />
                </TabsContent>
                <TabsContent value="motion">
                  <MotionEditorPanel />
                </TabsContent>
                <TabsContent value="captions">
                  <CaptionEditorPanel />
                </TabsContent>
                <TabsContent value="media">
                  <MediaLibraryPanel />
                </TabsContent>
                <TabsContent value="ai">
                  <AiEditingPanel />
                </TabsContent>
                <TabsContent value="export">
                  <ExportPanel />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  );
}

export const TRACK_KIND_LIST = TRACK_KINDS;
