"use client";

import * as React from "react";
import { Pause, Play, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMotionStyle } from "@/lib/motion/engine";
import { clipEndMs, formatTimecode, useEditor, type ClipView } from "./editor-types";

const ASPECT_RATIO_CLASS: Record<string, string> = {
  RATIO_9_16: "aspect-[9/16] max-h-[60vh]",
  RATIO_1_1: "aspect-square max-h-[60vh]",
  RATIO_16_9: "aspect-video",
};

function activeClipsOn(clips: ClipView[], trackId: string | undefined, ms: number): ClipView[] {
  return clips.filter((c) => c.trackId === trackId && ms >= c.startMs && ms < clipEndMs(c));
}

// Scene Preview — a genuine in-browser composite (not just a single <video>):
// the active VIDEO/IMAGE clip is the base layer, with active TEXT/STICKER/
// CAPTION clips overlaid absolutely-positioned on top, driven by a single
// playheadMs clock. This is a preview only — the real render/export still
// goes through composeTimeline() (lib/generation/video.ts), same as every
// other artifact in this app.
export function ScenePreview() {
  const {
    project,
    tracks,
    clips,
    sceneById,
    assetById,
    playheadMs,
    setPlayheadMs,
    playing,
    setPlaying,
    pxPerSecond,
    setPxPerSecond,
    totalDurationMs,
  } = useEditor();

  const videoTrack = tracks.find((t) => t.kind === "VIDEO" && !t.isHidden);
  const imageTrack = tracks.find((t) => t.kind === "IMAGE" && !t.isHidden);
  const textTracks = tracks.filter((t) => t.kind === "TEXT" && !t.isHidden);
  const stickerTracks = tracks.filter((t) => t.kind === "STICKER" && !t.isHidden);
  const captionTracks = tracks.filter((t) => t.kind === "CAPTION" && !t.isHidden);

  const activeVideoClip = activeClipsOn(clips, videoTrack?.id, playheadMs)[0];
  const activeImageClip = activeClipsOn(clips, imageTrack?.id, playheadMs)[0];
  const activeTextClips = textTracks.flatMap((t) => activeClipsOn(clips, t.id, playheadMs));
  const activeStickerClips = stickerTracks.flatMap((t) => activeClipsOn(clips, t.id, playheadMs));
  const activeCaptionClips = captionTracks.flatMap((t) => activeClipsOn(clips, t.id, playheadMs));

  const videoEl = React.useRef<HTMLVideoElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastTickRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      videoEl.current?.pause();
      return;
    }

    lastTickRef.current = performance.now();
    function tick(now: number) {
      const deltaMs = now - lastTickRef.current;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, totalDurationMs]);

  // Keep the active <video> element roughly in sync with the playhead
  // without fighting its own internal clock while playing.
  React.useEffect(() => {
    const el = videoEl.current;
    if (!el || !activeVideoClip) return;
    const sourceMs = activeVideoClip.trimStartMs + (playheadMs - activeVideoClip.startMs);
    if (playing) {
      if (el.paused) void el.play().catch(() => {});
      if (Math.abs(el.currentTime * 1000 - sourceMs) > 400) el.currentTime = sourceMs / 1000;
    } else {
      el.pause();
      el.currentTime = sourceMs / 1000;
    }
  }, [activeVideoClip, playheadMs, playing]);

  const videoScene = activeVideoClip?.sceneId ? sceneById.get(activeVideoClip.sceneId) : undefined;
  const imageScene = activeImageClip?.sceneId ? sceneById.get(activeImageClip.sceneId) : undefined;
  const videoAsset = activeVideoClip?.assetId ? assetById.get(activeVideoClip.assetId) : undefined;
  const imageAsset = activeImageClip?.assetId ? assetById.get(activeImageClip.assetId) : undefined;
  const videoSrc = videoScene?.videoUrl ?? videoAsset?.url ?? null;
  // Fix (2026-07-18) — ensureTimeline() (lib/timeline/engine.ts) seeds every
  // Talking Head scene's clip onto the VIDEO track ONLY; it never creates a
  // companion IMAGE-track clip, so a scene whose visual is an AI-generated
  // still (imageKey set, videoKey never populated because generation failed
  // or a B_ROLL slot has no base video of its own) had no path to ever
  // render here — always "No frame at this position," even on a real,
  // successfully-generated image. `videoScene?.imageUrl` is the fallback:
  // the SAME scene the active VIDEO-track clip already points at, read for
  // its image instead of its (absent) video. A genuine dedicated IMAGE-track
  // clip (imageScene/imageAsset, from a manually-added IMAGE track) still
  // wins first — this only fills the gap when nothing else would render.
  // Deliberately NOT a fix for the separate "B_ROLL's generated image should
  // composite as an overlay ON TOP of the base talking-head video" design
  // (confirmed real via resolveClipSourceUrl() in lib/render/pipeline.ts,
  // the Export System's own VIDEO+IMAGE dual-track compositing) — that's a
  // real, bigger, separate piece of work, not the blank-preview bug this
  // fixes; when a scene DOES have both a video and an image, video keeps
  // winning here exactly as before, unchanged.
  const imageSrc = imageScene?.imageUrl ?? imageAsset?.url ?? videoScene?.imageUrl ?? null;

  const activeVideoStyle = activeVideoClip
    ? getMotionStyle(activeVideoClip.content?.motionKeyframes, Math.max(0, playheadMs - activeVideoClip.startMs))
    : {};
  const activeImageStyle = activeImageClip
    ? getMotionStyle(activeImageClip.content?.motionKeyframes, Math.max(0, playheadMs - activeImageClip.startMs))
    : {};

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex justify-center">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-lg bg-black",
            ASPECT_RATIO_CLASS[project.aspectRatio] ?? "aspect-video"
          )}
        >
          {videoSrc ? (
            <video
              ref={videoEl}
              src={videoSrc}
              className="absolute inset-0 size-full object-contain"
              muted={false}
              playsInline
              style={activeVideoStyle}
            />
          ) : imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt="" className="absolute inset-0 size-full object-contain" style={activeImageStyle} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-body-sm text-neutral-500">
              No frame at this position
            </div>
          )}

          {activeTextClips.map((c) => (
            <TextOverlay key={c.id} clip={c} playheadMs={playheadMs} />
          ))}
          {activeStickerClips.map((c) => (
            <StickerOverlay key={c.id} clip={c} playheadMs={playheadMs} />
          ))}
          {activeCaptionClips.length > 0 && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
              <p className="rounded bg-black/60 px-3 py-1 text-center text-sm font-medium text-white">
                Captions update from the Captions panel
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPlaying(!playing)} title="Play/Pause (Space)">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <input
          type="range"
          min={0}
          max={Math.max(totalDurationMs, 1)}
          value={Math.min(playheadMs, totalDurationMs)}
          onChange={(e) => setPlayheadMs(Number(e.target.value))}
          className="flex-1"
        />
        <p className="w-28 shrink-0 text-right text-label-sm text-neutral-500">
          {formatTimecode(playheadMs)} / {formatTimecode(totalDurationMs)}
        </p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPxPerSecond(Math.max(10, pxPerSecond - 10))} title="Zoom out timeline">
            <ZoomOut className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPxPerSecond(Math.min(200, pxPerSecond + 10))} title="Zoom in timeline">
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TextOverlay({ clip, playheadMs }: { clip: ClipView; playheadMs: number }) {
  const c = clip.content ?? {};
  const elapsedMs = Math.max(0, playheadMs - clip.startMs);
  const motionStyle = getMotionStyle(c.motionKeyframes, elapsedMs);
  const transform = `${motionStyle.transform ?? "translate(0, 0)"} translate(-50%, -50%)`;
  const gradient = c.gradientStartColor && c.gradientEndColor ? `linear-gradient(${c.gradientAngle ?? 90}deg, ${c.gradientStartColor}, ${c.gradientEndColor})` : undefined;
  const textShadow = c.shadowColor ? `0 0 ${c.shadowBlur ?? 4}px ${c.shadowColor}` : undefined;
  const glow = c.glowColor ? `0 0 ${c.glowSpread ?? 12}px ${c.glowColor}` : undefined;

  return (
    <div
      className="absolute left-1/2 top-1/2 px-4 text-center"
      style={{
        fontFamily: c.fontFamily,
        fontSize: c.fontSize ? `${c.fontSize}px` : undefined,
        fontWeight: c.fontWeight ?? "700",
        fontStyle: c.fontStyle ?? "normal",
        textDecoration: c.textDecoration ?? "none",
        textAlign: c.textAlign ?? "center",
        lineHeight: c.lineHeight ?? 1.2,
        letterSpacing: c.letterSpacing ? `${c.letterSpacing}px` : undefined,
        color: gradient ? "transparent" : c.color ?? "#FFFFFF",
        backgroundColor: c.backgroundColor ?? "transparent",
        backgroundImage: gradient,
        WebkitBackgroundClip: gradient ? "text" : undefined,
        WebkitTextFillColor: gradient ? "transparent" : undefined,
        WebkitTextStroke: c.strokeColor && c.strokeWidth ? `${c.strokeWidth}px ${c.strokeColor}` : undefined,
        textShadow,
        boxShadow: glow,
        transform,
        opacity: motionStyle.opacity,
        filter: motionStyle.filter,
        clipPath: motionStyle.clipPath,
      }}
    >
      {c.text ?? "Text"}
    </div>
  );
}

function StickerOverlay({ clip, playheadMs }: { clip: ClipView; playheadMs: number }) {
  const c = clip.content ?? {};
  const x = typeof c.x === "number" ? c.x : 0.5;
  const y = typeof c.y === "number" ? c.y : 0.5;
  const scale = typeof c.scale === "number" ? c.scale : 1;
  const rotation = typeof c.rotation === "number" ? c.rotation : 0;
  const elapsedMs = Math.max(0, playheadMs - clip.startMs);
  const motionStyle = getMotionStyle(c.motionKeyframes, elapsedMs);
  const transform = `${motionStyle.transform ?? `translate(${x * 100}%, ${y * 100}%)`} translate(-50%, -50%)`;

  return (
    <div
      className="absolute flex size-16 items-center justify-center rounded bg-white/10 text-2xl"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform,
        opacity: motionStyle.opacity,
        filter: motionStyle.filter,
        clipPath: motionStyle.clipPath,
      }}
    >
      ⭐
    </div>
  );
}
