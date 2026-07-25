"use client";

import * as React from "react";
import { CompositorStage } from "../compositor-stage";
import { bounceAudioToWav } from "./audio-bounce";
import type { AssetView, ClipView, TrackView, TransitionView } from "../../types";

// Module 10 — the headless render-mode workspace. Deliberately minimal: no
// TopToolbar/Sidebar/Timeline/PropertiesPanel, no Zustand store, no
// TanStack Query (data arrives once as server-fetched props, never
// refetched — a render worker's browser context is short-lived and the
// project is frozen for the duration of one export anyway). Mounts
// CompositorStage — the EXACT SAME component the live Preview Window
// uses — at an EXACT pixel size (not the live editor's responsive/
// aspect-ratio CSS), and exposes a small imperative control surface on
// `window.__renderControl` for the Node.js export worker (running outside
// the browser) to drive via Playwright's `page.evaluate()`.
export function RenderWorkspace({
  tracks,
  clips,
  transitions,
  assets,
  widthPx,
  heightPx,
  watermarkText,
}: {
  tracks: TrackView[];
  clips: ClipView[];
  transitions: TransitionView[];
  assets: AssetView[];
  widthPx: number;
  heightPx: number;
  // Export presets (2026-07-15) — null/undefined renders nothing (the
  // default, and always the case for the live interactive Preview Window,
  // which never mounts this component at all). Rendered as a plain DOM
  // overlay INSIDE the same pixel-exact stage every frame is screenshotted
  // from, so it's captured by the export worker's existing frame-capture
  // step with zero new code there — no separate FFmpeg drawtext/overlay
  // filter pass.
  watermarkText?: string | null;
}) {
  const [playheadMs, setPlayheadMs] = React.useState(0);
  const assetById = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  React.useEffect(() => {
    const totalDurationMs = clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);

    async function setFrame(atMs: number): Promise<void> {
      setPlayheadMs(atMs);
      // Let React commit the new playheadMs and paint at least one frame
      // before checking video-seek state below — two rAF ticks reliably
      // spans a commit+paint in every browser this worker targets
      // (Chromium via Playwright).
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await waitForAllVideosToSettle();
    }

    // Every <video> element CompositorStage mounted for the current frame
    // must finish its currentTime seek before a screenshot is accurate —
    // useSyncedMediaElement sets .currentTime synchronously in an effect,
    // but the browser decodes to that exact frame asynchronously. Polls
    // rather than only listening for `seeked` (belt-and-suspenders: a
    // `seeked` listener attached after the seek already started would miss
    // the event entirely) with a bounded worst-case wait per frame.
    async function waitForAllVideosToSettle(): Promise<void> {
      const videos = Array.from(document.querySelectorAll("video"));
      const deadline = Date.now() + 800;
      while (Date.now() < deadline) {
        const allSettled = videos.every((v) => !v.seeking && v.readyState >= 2);
        if (allSettled) return;
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }

    (window as unknown as { __renderControl: RenderControl }).__renderControl = {
      totalDurationMs,
      setFrame,
      bounceAudio: async () => {
        const blob = await bounceAudioToWav({ tracks, clips, transitions, assetById, totalDurationMs });
        const arrayBuffer = await blob.arrayBuffer();
        return arrayBufferToBase64(arrayBuffer);
      },
      ready: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-render-stage style={{ position: "relative", width: widthPx, height: heightPx, overflow: "hidden", background: "black" }}>
      <CompositorStage
        tracks={tracks}
        clips={clips}
        transitions={transitions}
        assetById={assetById}
        playheadMs={playheadMs}
        playing={false}
        playbackRate={1}
      />
      {watermarkText && (
        // Real bug found live (2026-07-15) — CompositorStage's own layers
        // always set an EXPLICIT numeric zIndex (computeTrackZIndex); a
        // sibling with no zIndex at all is treated as zIndex:0 for CSS
        // stacking purposes, which loses to ANY track's layer regardless of
        // DOM order — the watermark was rendering, just fully hidden
        // behind the video content. A zIndex far above the highest
        // possible track stack (computeTrackZIndex tops out at roughly
        // 2×track count) guarantees it always wins.
        <div
          data-watermark
          style={{
            position: "absolute",
            right: widthPx * 0.02,
            bottom: heightPx * 0.02,
            fontSize: Math.max(12, Math.round(widthPx * 0.018)),
            lineHeight: 1,
            color: "rgba(255, 255, 255, 0.65)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 600,
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.6)",
            pointerEvents: "none",
            zIndex: 999999,
          }}
        >
          {watermarkText}
        </div>
      )}
    </div>
  );
}

export interface RenderControl {
  totalDurationMs: number;
  setFrame: (atMs: number) => Promise<void>;
  bounceAudio: () => Promise<string>; // base64-encoded WAV bytes
  ready: true;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
