"use client";

import * as React from "react";
import {
  Gauge,
  Maximize,
  Minimize,
  Monitor,
  Pause,
  Play,
  RectangleHorizontal,
  RectangleVertical,
  SkipBack,
  SkipForward,
  Square,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PLAYBACK_RATES,
  PREVIEW_QUALITIES,
  useEditorStore,
  useEditorStoreApi,
  type PlaybackRate,
  type PreviewQuality,
} from "./store";
import { useEditorAssetsQuery, useUpdateClipMutation, useUpdateProjectAspectRatioMutation } from "./queries";
import { createUpdateTransformCommand, type ClipCommandDeps } from "./commands";
import { isTextEditableTarget, resolveEditorSeekDelta } from "../keyboard-utils";
import {
  DEFAULT_CLIP_TRANSFORM,
  resolveClipTransform,
  updateKeyframeValue,
  type ClipTransform,
  type CropRect,
  type EditorKeyframe,
  type Point2D,
  type ResolvedTransform,
} from "@/lib/video-editor/transform";
import { CompositorStage, resumeSharedAudioContext } from "./compositor-stage";
import { clipEndMs, formatTimecode, type AssetView, type ClipView, type ProjectView, type TrackView, type TransitionView } from "../types";

const PREVIEW_QUALITY_LABEL: Record<PreviewQuality, string> = {
  AUTO: "Auto",
  R1080P: "1080p",
  R720P: "720p",
  R480P: "480p",
};
const PREVIEW_QUALITY_MAX_HEIGHT: Record<PreviewQuality, number | null> = {
  AUTO: null,
  R1080P: 1080,
  R720P: 720,
  R480P: 480,
};

// Aspect-ratio quick-switch (design-token pass, 2026-07-13) — real project
// setting (EditorProject.aspectRatio/widthPx/heightPx, see
// lib/video-editor/aspect-dimensions.ts), not a display-only toggle: PATCHes
// the project, and the server derives widthPx/heightPx from the enum, which
// is what this stage's own aspectRatio CSS (below) and the Export Engine
// both read for actual output. Only the 3 ratios that lookup covers —
// RATIO_4_5/CUSTOM stay creation-only, no quick-switch button for those.
const ASPECT_SWITCH_OPTIONS: { ratio: "RATIO_16_9" | "RATIO_9_16" | "RATIO_1_1"; label: string; Icon: LucideIcon }[] = [
  { ratio: "RATIO_16_9", label: "Desktop 16:9", Icon: RectangleHorizontal },
  { ratio: "RATIO_9_16", label: "Mobile 9:16", Icon: RectangleVertical },
  { ratio: "RATIO_1_1", label: "Square 1:1", Icon: Square },
];

// Preview Window (Milestone 24, playback engine in Module 3, transforms in
// Module 4) — DOM-layered compositing driven by one requestAnimationFrame
// playhead clock, the SAME clock the Timeline's playhead line reads.
//
// Module 10 — the actual layer-rendering logic (every track's active
// clip(s), transform/transition/text/audio resolution) now lives in
// compositor-stage.tsx's `CompositorStage`, shared verbatim with the
// headless Export render-mode route — this component is now just the
// INTERACTIVE shell around it: playback controls, the rAF clock, crop
// handles, motion path, fullscreen, and preview-quality scaling. See
// compositor-stage.tsx's file header for why that split exists.
//
// Module 4 — every layer's transform is resolved via
// lib/video-editor/transform.ts's resolveClipTransform/composeTransformCss
// (shared, pure, framework-agnostic). While a Properties Panel control is
// being dragged, `liveClipOverride` (store.tsx) substitutes for that one
// clip's server-confirmed transform so the compositor updates live without
// a mutation firing on every pixel of the drag.
//
// Crop handles render directly on the stage for the single selected clip
// when it's the active VIDEO/IMAGE base layer — scoped to that case only
// (not OVERLAY/TEXT, whose native render size isn't the full stage) and
// computed ignoring rotation (a documented simplification: the handles
// track scale+position correctly, a rotated clip's crop box just won't
// visually rotate with it — precise numeric crop entry in the panel still
// works regardless of rotation).
export function PreviewWindow({
  projectId,
  project,
  tracks,
  clips,
  transitions,
}: {
  projectId: string;
  project: ProjectView;
  tracks: TrackView[];
  clips: ClipView[];
  transitions: TransitionView[];
}) {
  const playing = useEditorStore((s) => s.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const setPlayheadMs = useEditorStore((s) => s.setPlayheadMs);
  const playbackRate = useEditorStore((s) => s.playbackRate);
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate);
  const previewQuality = useEditorStore((s) => s.previewQuality);
  const setPreviewQuality = useEditorStore((s) => s.setPreviewQuality);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const liveClipOverride = useEditorStore((s) => s.liveClipOverride);
  const setLiveClipOverride = useEditorStore((s) => s.setLiveClipOverride);
  const storeApi = useEditorStoreApi();

  const updateClipMutation = useUpdateClipMutation(projectId);
  const updateAspectRatioMutation = useUpdateProjectAspectRatioMutation(projectId);
  const commandDeps: ClipCommandDeps = React.useMemo(
    () => ({
      updateClip: (input) => updateClipMutation.mutateAsync(input),
      deleteClip: () => Promise.resolve(),
      addClip: () => Promise.reject(new Error("not used")),
      splitClip: () => Promise.reject(new Error("not used")),
      rippleDeleteClip: () => Promise.reject(new Error("not used")),
      duplicateClip: () => Promise.reject(new Error("not used")),
      replaceClipSource: () => Promise.reject(new Error("not used")),
      groupClips: () => Promise.reject(new Error("not used")),
      ungroupClips: () => Promise.reject(new Error("not used")),
      restoreTransition: () => Promise.reject(new Error("not used")),
    }),
    [updateClipMutation]
  );

  const assetsQuery = useEditorAssetsQuery();
  const assetById = React.useMemo(() => {
    const map = new Map<string, AssetView>();
    for (const asset of assetsQuery.data ?? []) map.set(asset.id, asset);
    return map;
  }, [assetsQuery.data]);

  const totalDurationMs = React.useMemo(() => clips.reduce((max, c) => Math.max(max, clipEndMs(c)), 0), [clips]);
  const frameMs = 1000 / Math.max(1, project.fps);

  const rafRef = React.useRef<number | null>(null);
  const lastTickRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();

    function tick(now: number) {
      const deltaMs = (now - lastTickRef.current) * playbackRate;
      lastTickRef.current = now;
      setPlayheadMs((ms) => {
        const next = ms + deltaMs;
        if (next >= totalDurationMs) {
          setPlaying(false);
          return totalDurationMs;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, playbackRate, totalDurationMs, setPlayheadMs, setPlaying]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Same class of fix as timeline-panel.tsx/top-toolbar.tsx: a range
      // slider having focus (very likely here, right next to the seek bar)
      // shouldn't block frame-step.
      if (isTextEditableTarget(e.target)) return;
      const delta = resolveEditorSeekDelta(e, frameMs);
      if (!delta) return;
      e.preventDefault();
      setPlaying(false);
      setPlayheadMs((ms) => Math.max(0, Math.min(totalDurationMs, ms + delta.direction * delta.stepMs)));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [frameMs, totalDurationMs, setPlayheadMs, setPlaying]);

  function stepFrame(direction: 1 | -1) {
    setPlaying(false);
    setPlayheadMs((ms) => Math.max(0, Math.min(totalDurationMs, ms + direction * frameMs)));
  }

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Real bug found live (2026-07-15, category-6 export/preview pixel-match
  // verification) — `data-preview-stage` (below) is sized by CSS
  // (aspect-ratio + height:100%/max-width:100%) to whatever fits the
  // window, essentially never exactly `project.widthPx`×`heightPx`. The
  // Export render path (render-workspace.tsx's `data-render-stage`) sizes
  // its stage to the LITERAL native resolution instead. CompositorStage
  // itself has no wrapping element of its own (a bare Fragment — every
  // layer inside is `position: absolute` against whatever parent it's
  // given) and every TEXT-layer style value (fontSize, letterSpacing,
  // strokeWidth, shadowBlur, glow) is a raw CSS px, not scaled to the
  // stage's actual size. Net effect, confirmed via real exported-frame vs.
  // live-preview-screenshot comparison at matching timestamps: the SAME
  // 64px font wraps to one line at export's native 1280px-wide stage but
  // TWO lines at preview's smaller on-screen stage (708px in the
  // reproduction) — a genuine, structural preview/export mismatch, not
  // just compression noise, and not limited to text (every absolute-px
  // style in the compositor is equally affected). Fixed by rendering
  // CompositorStage inside a wrapper pinned to the project's real native
  // resolution, then visually scaling that whole wrapper down to fit the
  // on-screen stage via a CSS transform — the same "design at fixed
  // resolution, display scaled" pattern render-workspace.tsx's fixed-px
  // stage already gets for free by not being CSS-fit at all. `stageRef`
  // itself (the OUTER, CSS-fit element) is intentionally left alone: the
  // crop-handle/motion-path drag math below reads its on-screen
  // clientWidth/clientHeight to convert pixel deltas into resolution-
  // independent percentages, which stays correct either way.
  const [displayScale, setDisplayScale] = React.useState(1);
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setDisplayScale(width / project.widthPx);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [project.widthPx]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapperRef.current?.requestFullscreen();
  }

  function effectiveTransform(clip: ClipView): ClipTransform | null {
    return liveClipOverride?.clipId === clip.id ? liveClipOverride.transform : clip.transform;
  }

  const maxHeight = PREVIEW_QUALITY_MAX_HEIGHT[previewQuality];

  // The single selected clip, if it's the currently-active VIDEO-track
  // base layer — the only case crop handles render for (see file header).
  let cropHandleTarget: { clip: ClipView; resolved: ResolvedTransform } | null = null;
  if (selectedClipIds.size === 1) {
    const [selectedId] = selectedClipIds;
    const selectedClip = clips.find((c) => c.id === selectedId);
    if (selectedClip) {
      const track = tracks.find((t) => t.id === selectedClip.trackId);
      const isActive = playheadMs >= selectedClip.startMs && playheadMs < clipEndMs(selectedClip);
      if (track?.kind === "VIDEO" && !track.isHidden && isActive) {
        // Keyframe timeMs is clip-relative (Module 6) — 0 at the clip's own
        // timeline start — so retiming a clip never requires rewriting its
        // keyframes.
        cropHandleTarget = {
          clip: selectedClip,
          resolved: resolveClipTransform(effectiveTransform(selectedClip), playheadMs - selectedClip.startMs),
        };
      }
    }
  }

  return (
    <div ref={wrapperRef} className="flex flex-1 flex-col overflow-hidden bg-editor-bg">
      {/* Header row (2026-07-14, full-spec audit) — real, plain "Preview"
          title, matching the visual language every other rebuilt panel
          already uses (Left Panel's PanelHeader, Right Panel's
          "Properties" h2). No overflow-menu icon: the reference shows one,
          but this preview stage has no real per-panel menu actions to back
          it (no rename/duplicate/close-panel feature exists here) — per
          the no-fake-UI rule, flagged and left out rather than built as a
          dead button.
          Reconfirmed, not re-decided (2026-07-14, second reference pass) —
          the newest CapCut screenshot again shows "Player-Timeline 01" as
          the title; kept "Preview" instead since "Player-Timeline 01" is
          CapCut's own per-project auto-numbering, not real data this app
          tracks per panel instance — a literal copy would be a fake label,
          not a real one. Column width (~502px in the reference) also not
          forced to match: this app's Left Panel (420px) and Right Panel
          (256px) widths were both deliberately tuned in their own earlier
          passes against this app's real content, not CapCut's — Preview
          fills whatever remains, which is wider than 502px on a same-size
          window as a direct consequence, not an oversight. */}
      <div className="flex h-10 shrink-0 items-center border-b border-editor-line px-4 text-editor-caption font-medium text-neutral-300">
        Preview
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-6">
        {/* Fix (2026-07-14) — restyled against premium-editor.jsx: each
            button is now its own bordered square (matching the mockup's
            30x30 individually-boxed buttons) instead of three ghost buttons
            sharing one bordered pill. Same real onClick/mutation as before —
            this genuinely PATCHes project.aspectRatio (see the mutation's
            own doc comment in queries.ts), not a display-only toggle.
            Kept as 3 explicit buttons rather than the newest CapCut
            reference's single "Ratio" badge+dropdown in the bottom control
            row — same real feature (project.aspectRatio), different
            affordance; flagged rather than silently rebuilt, since the
            3-button version is already a working, more discoverable
            control (each option visible and one click away, vs. a dropdown
            requiring an extra click to see the choices) and restructuring
            it purely for a visual-parity match would trade away that for
            no functional gain. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {ASPECT_SWITCH_OPTIONS.map(({ ratio, label, Icon }) => {
            const active = project.aspectRatio === ratio;
            return (
              <Tooltip key={ratio}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={updateAspectRatioMutation.isPending}
                    onClick={() => updateAspectRatioMutation.mutate(ratio)}
                    className={cn(
                      "flex size-[30px] items-center justify-center rounded-lg border transition-colors disabled:opacity-50",
                      active
                        ? "border-editor-accent/50 bg-editor-accent/15 text-editor-accent"
                        : "border-editor-line bg-editor-surface-1 text-neutral-400 hover:text-white"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Stage sizing (2026-07-14, full-spec audit) — a spec pass asked
            for a width:auto/height:auto CONTAIN pattern, reasoning that
            the prior height:"100%" + aspect-ratio could compute a width
            wider than the parent, clamped by max-width without height
            shrinking to match. Tried it, verified live, and it does NOT
            work for a plain `<div>`: unlike an <img>/<video> (a replaced
            element with an intrinsic size that width/height:auto resolves
            against), a bare div has no intrinsic size, so
            width:auto/height:auto against an aspect-ratio alone resolved
            to a genuine 0×0 box (confirmed via a real Playwright
            boundingBox() check — not a hunch). Reverted to the
            height:"100%" + max-width/max-height:"100%" pattern this app
            has actually used and verified correct across 9:16/16:9/1:1
            (and RATIO_1_1 quality-capped) projects in many earlier
            screenshots this session — real evidence beats a plausible-
            sounding CSS argument that didn't hold up when tested. */}
        <div
          ref={stageRef}
          data-preview-stage
          className="relative max-h-full max-w-full"
          style={{
            aspectRatio: `${project.widthPx} / ${project.heightPx}`,
            height: "100%",
            ...(maxHeight ? { maxHeight: `${maxHeight}px` } : {}),
          }}
        >
        {/* Layers are clipped to the visible frame here; crop handles are
            siblings OUTSIDE this clipped box (see below) — a scaled-up clip
            (>100%) legitimately has crop-handle positions outside the 0–100%
            frame, and clipping them here would make them undraggable.
            Sharp corners (2026-07-14, CapCut reference pass) — the
            reference's own player canvas has no border-radius at all;
            supersedes premium-editor.jsx's rounded-[20px] treatment for
            this specific element, per the founder's explicit "match this
            as closely as possible" direction for the CapCut screenshot. */}
        <div className="absolute inset-0 overflow-hidden bg-black shadow-[0_26px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)]">
          <div
            style={{
              width: project.widthPx,
              height: project.heightPx,
              transform: `scale(${displayScale})`,
              transformOrigin: "top left",
            }}
          >
            <CompositorStage
              tracks={tracks}
              clips={clips}
              transitions={transitions}
              assetById={assetById}
              playheadMs={playheadMs}
              playing={playing}
              playbackRate={playbackRate}
              effectiveTransform={effectiveTransform}
            />
          </div>
        </div>

        {cropHandleTarget && (
          <CropHandles
            resolved={cropHandleTarget.resolved}
            onLiveChange={(crop) => {
              const current = cropHandleTarget!.clip.transform ?? DEFAULT_CLIP_TRANSFORM;
              setLiveClipOverride({ clipId: cropHandleTarget!.clip.id, transform: { ...current, crop: { value: crop, keyframes: null } } });
            }}
            onCommit={(crop) => {
              const clip = cropHandleTarget!.clip;
              const previous = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
              const next: ClipTransform = { ...previous, crop: { value: crop, keyframes: null } };
              void storeApi
                .getState()
                .runCommand(createUpdateTransformCommand(commandDeps, clip.id, previous, next))
                .catch(() => {})
                .finally(() => {
                  if (storeApi.getState().liveClipOverride?.clipId === clip.id) setLiveClipOverride(null);
                });
            }}
          />
        )}

        {/* Module 6 — Motion Path. Same scoping as crop handles (single
            selected, currently-active base VIDEO/IMAGE clip), additionally
            gated on Position actually having keyframes — a static position
            has nothing to visualize. */}
        {cropHandleTarget && cropHandleTarget.clip.transform?.position.keyframes?.length ? (
          <MotionPath
            clip={cropHandleTarget.clip}
            keyframes={cropHandleTarget.clip.transform.position.keyframes}
            onLiveChange={(keyframeId, point) => {
              const current = cropHandleTarget!.clip.transform ?? DEFAULT_CLIP_TRANSFORM;
              setLiveClipOverride({
                clipId: cropHandleTarget!.clip.id,
                transform: { ...current, position: updateKeyframeValue(current.position, keyframeId, point) },
              });
            }}
            onCommit={(keyframeId, point) => {
              const clip = cropHandleTarget!.clip;
              const previous = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
              const next: ClipTransform = { ...previous, position: updateKeyframeValue(previous.position, keyframeId, point) };
              void storeApi
                .getState()
                .runCommand(createUpdateTransformCommand(commandDeps, clip.id, previous, next))
                .catch(() => {})
                .finally(() => {
                  if (storeApi.getState().liveClipOverride?.clipId === clip.id) setLiveClipOverride(null);
                });
            }}
          />
        ) : null}
      </div>

      {/* Fix (2026-07-14) — restyled against premium-editor.jsx: the
          mockup's own playback row has no bordered/backdrop-blur pill
          container at all, just a plain centered row, and its play button
          is visually emphasized (circular, accent gradient) against small
          ghost prev/next buttons — matched both here. Two real deviations
          from the mockup's own JSX, kept deliberately: (1) the mockup has
          no seek bar at all (likely a mockup-simplicity omission, not an
          intentional cut) — scrubbing is real, working functionality, so
          it stays, restyled to fit this plainer row instead of removed;
          (2) the mockup's "RefreshCw" icon has no real feature behind it
          in this app (nothing to "refresh" here) — omitted rather than
          built as a dead button. Speed/Quality/Fullscreen are all real,
          existing controls, kept and restyled, not the mockup's static
          "HD" text badge. */}
      <div className="flex w-full max-w-3xl items-center justify-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:bg-editor-surface-2 hover:text-white" title="Previous frame (←)" onClick={() => stepFrame(-1)} disabled={totalDurationMs === 0}>
          <SkipBack className="size-4" />
        </Button>
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--color-editor-accent)_0%,#4057af_100%)] text-white shadow-[0_6px_16px_rgba(91,124,250,0.45)] transition-opacity disabled:opacity-40"
          onClick={() => {
            resumeSharedAudioContext();
            setPlaying(!playing);
          }}
          disabled={totalDurationMs === 0}
        >
          {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
        </button>
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:bg-editor-surface-2 hover:text-white" title="Next frame (→)" onClick={() => stepFrame(1)} disabled={totalDurationMs === 0}>
          <SkipForward className="size-4" />
        </Button>

        <span className="w-16 text-right text-editor-caption text-neutral-400 tabular-nums">{formatTimecode(playheadMs)}</span>
        <input
          type="range"
          data-seek-bar="true"
          min={0}
          max={Math.max(totalDurationMs, 1)}
          value={Math.min(playheadMs, totalDurationMs)}
          onChange={(e) => setPlayheadMs(Number(e.target.value))}
          className="h-1 max-w-[255px] flex-1 accent-editor-accent"
        />
        <span className="w-16 text-editor-caption text-neutral-400 tabular-nums">{formatTimecode(totalDurationMs)}</span>

        <div className="h-4 w-px shrink-0 bg-editor-line" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 rounded-md border border-editor-line bg-editor-surface-1 px-2 text-editor-caption text-neutral-300 hover:bg-editor-surface-2 hover:text-white" title="Playback speed">
              <Gauge className="size-3.5" />
              {playbackRate}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PLAYBACK_RATES.map((rate) => (
              <DropdownMenuItem key={rate} onClick={() => setPlaybackRate(rate as PlaybackRate)}>
                {rate}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 rounded-md border border-editor-line bg-editor-surface-1 px-2 text-editor-caption text-neutral-300 hover:bg-editor-surface-2 hover:text-white" title="Preview quality">
              <Monitor className="size-3.5" />
              {PREVIEW_QUALITY_LABEL[previewQuality]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PREVIEW_QUALITIES.map((quality) => (
              <DropdownMenuItem key={quality} onClick={() => setPreviewQuality(quality as PreviewQuality)}>
                {PREVIEW_QUALITY_LABEL[quality]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:bg-editor-surface-2 hover:text-white" title="Fullscreen" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
        </Button>
      </div>
      </div>
    </div>
  );
}

type HandleId = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
const HANDLES: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

interface CropDragState {
  handle: HandleId;
  startClientX: number;
  startClientY: number;
  startCrop: CropRect;
  rafScheduled: boolean;
  deltaX: number;
  deltaY: number;
}

// Renders 8 drag handles (4 corners + 4 edges) at the current crop
// boundary of the target clip's on-screen box (scale+position accounted
// for, rotation ignored — see the file header). Live-updates via the
// store's liveClipOverride, rAF-batched; commits via
// createUpdateTransformCommand on release.
function CropHandles({
  resolved,
  onLiveChange,
  onCommit,
}: {
  resolved: ResolvedTransform;
  onLiveChange: (crop: CropRect) => void;
  onCommit: (crop: CropRect) => void;
}) {
  const dragRef = React.useRef<CropDragState | null>(null);
  const stageSizeRef = React.useRef({ widthPx: 1, heightPx: 1 });

  const scaleXFrac = resolved.scaleX / 100;
  const scaleYFrac = resolved.scaleY / 100;
  const centerX = 50 + resolved.x;
  const centerY = 50 + resolved.y;
  const boxLeft = centerX - 50 * scaleXFrac;
  const boxTop = centerY - 50 * scaleYFrac;
  const boxWidth = 100 * scaleXFrac;
  const boxHeight = 100 * scaleYFrac;

  const cropLeft = boxLeft + (resolved.crop.left / 100) * boxWidth;
  const cropRight = boxLeft + boxWidth - (resolved.crop.right / 100) * boxWidth;
  const cropTop = boxTop + (resolved.crop.top / 100) * boxHeight;
  const cropBottom = boxTop + boxHeight - (resolved.crop.bottom / 100) * boxHeight;
  const midX = (cropLeft + cropRight) / 2;
  const midY = (cropTop + cropBottom) / 2;

  const handlePos: Record<HandleId, { left: number; top: number; cursor: string }> = {
    nw: { left: cropLeft, top: cropTop, cursor: "nwse-resize" },
    n: { left: midX, top: cropTop, cursor: "ns-resize" },
    ne: { left: cropRight, top: cropTop, cursor: "nesw-resize" },
    e: { left: cropRight, top: midY, cursor: "ew-resize" },
    se: { left: cropRight, top: cropBottom, cursor: "nwse-resize" },
    s: { left: midX, top: cropBottom, cursor: "ns-resize" },
    sw: { left: cropLeft, top: cropBottom, cursor: "nesw-resize" },
    w: { left: cropLeft, top: midY, cursor: "ew-resize" },
  };

  function computeCrop(drag: CropDragState): CropRect {
    const deltaXPct = (drag.deltaX / stageSizeRef.current.widthPx) * 100;
    const deltaYPct = (drag.deltaY / stageSizeRef.current.heightPx) * 100;
    // Convert a stage-relative % delta into "% of the box" (crop insets
    // are relative to the clip's own box, not the stage).
    const deltaLeftInset = (deltaXPct / boxWidth) * 100;
    const deltaTopInset = (deltaYPct / boxHeight) * 100;

    let { top, right, bottom, left } = drag.startCrop;
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);

    if (drag.handle.includes("w")) left = clamp(drag.startCrop.left + deltaLeftInset, 100 - right);
    if (drag.handle.includes("e")) right = clamp(drag.startCrop.right - deltaLeftInset, 100 - left);
    if (drag.handle.includes("n")) top = clamp(drag.startCrop.top + deltaTopInset, 100 - bottom);
    if (drag.handle.includes("s")) bottom = clamp(drag.startCrop.bottom - deltaTopInset, 100 - top);

    return { top, right, bottom, left };
  }

  function scheduleFrame() {
    const drag = dragRef.current;
    if (!drag || drag.rafScheduled) return;
    drag.rafScheduled = true;
    requestAnimationFrame(() => {
      const current = dragRef.current;
      if (!current) return;
      current.rafScheduled = false;
      onLiveChange(computeCrop(current));
    });
  }

  function onMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.deltaX = e.clientX - drag.startClientX;
    drag.deltaY = e.clientY - drag.startClientY;
    scheduleFrame();
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) onCommit(computeCrop(drag));
  }

  function startDrag(handle: HandleId) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      const stage = (e.currentTarget as HTMLElement).closest("[data-preview-stage]") as HTMLElement | null;
      if (stage) stageSizeRef.current = { widthPx: stage.clientWidth, heightPx: stage.clientHeight };
      dragRef.current = { handle, startClientX: e.clientX, startClientY: e.clientY, startCrop: resolved.crop, rafScheduled: false, deltaX: 0, deltaY: 0 };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  return (
    <>
      <div
        className="pointer-events-none absolute z-30 border border-dashed border-editor-accent"
        style={{ left: `${cropLeft}%`, top: `${cropTop}%`, width: `${cropRight - cropLeft}%`, height: `${cropBottom - cropTop}%` }}
      />
      {HANDLES.map((handle) => (
        <div
          key={handle}
          className="absolute z-30 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/40 bg-editor-accent"
          style={{ left: `${handlePos[handle].left}%`, top: `${handlePos[handle].top}%`, cursor: handlePos[handle].cursor }}
          onPointerDown={startDrag(handle)}
        />
      ))}
    </>
  );
}

interface MotionPointDragState {
  keyframeId: string;
  startClientX: number;
  startClientY: number;
  startValue: Point2D;
  rafScheduled: boolean;
  deltaX: number;
  deltaY: number;
}

// Module 6 — Position keyframes plotted directly on the preview stage
// (dots connected by a straight-line polyline; a full bezier-through-
// keyframes render would need to match resolveTransformValue's actual
// easing per segment, which is a nice-to-have, not required — same
// "reasonable simplification, documented" trade-off crop handles already
// make with rotation). Each dot is draggable to retarget that keyframe's
// position without leaving the preview stage; timing (which keyframe, at
// what time) still comes from the Timeline's keyframe track.
function MotionPath({
  clip,
  keyframes,
  onLiveChange,
  onCommit,
}: {
  clip: ClipView;
  keyframes: EditorKeyframe<Point2D>[];
  onLiveChange: (keyframeId: string, point: Point2D) => void;
  onCommit: (keyframeId: string, point: Point2D) => void;
}) {
  const dragRef = React.useRef<MotionPointDragState | null>(null);
  const stageSizeRef = React.useRef({ widthPx: 1, heightPx: 1 });
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);

  function stagePoint(value: Point2D) {
    return { left: 50 + value.x, top: 50 + value.y };
  }

  function scheduleFrame() {
    const drag = dragRef.current;
    if (!drag || drag.rafScheduled) return;
    drag.rafScheduled = true;
    requestAnimationFrame(() => {
      const current = dragRef.current;
      if (!current) return;
      current.rafScheduled = false;
      const deltaXPct = (current.deltaX / stageSizeRef.current.widthPx) * 100;
      const deltaYPct = (current.deltaY / stageSizeRef.current.heightPx) * 100;
      onLiveChange(current.keyframeId, { x: current.startValue.x + deltaXPct, y: current.startValue.y + deltaYPct });
    });
  }

  function onMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.deltaX = e.clientX - drag.startClientX;
    drag.deltaY = e.clientY - drag.startClientY;
    scheduleFrame();
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag) {
      const deltaXPct = (drag.deltaX / stageSizeRef.current.widthPx) * 100;
      const deltaYPct = (drag.deltaY / stageSizeRef.current.heightPx) * 100;
      onCommit(drag.keyframeId, { x: drag.startValue.x + deltaXPct, y: drag.startValue.y + deltaYPct });
    }
  }

  function startDrag(keyframeId: string, startValue: Point2D) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      const stage = (e.currentTarget as HTMLElement).closest("[data-preview-stage]") as HTMLElement | null;
      if (stage) stageSizeRef.current = { widthPx: stage.clientWidth, heightPx: stage.clientHeight };
      dragRef.current = { keyframeId, startClientX: e.clientX, startClientY: e.clientY, startValue, rafScheduled: false, deltaX: 0, deltaY: 0 };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  const points = sorted.map((kf) => stagePoint(kf.value));

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points.map((p) => `${p.left},${p.top}`).join(" ")}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {sorted.map((kf, i) => (
        <div
          key={kf.id}
          className="absolute z-30 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-sky-400 cursor-move"
          style={{ left: `${points[i].left}%`, top: `${points[i].top}%` }}
          title={`Position keyframe at t=${kf.timeMs}ms — drag to retarget, clip "${clip.id}"`}
          onPointerDown={startDrag(kf.id, kf.value)}
        />
      ))}
    </>
  );
}
