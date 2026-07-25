"use client";

import * as React from "react";
import {
  composeTransformCss,
  resolveClipTransform,
  type BlendMode,
  type ClipTransform,
} from "@/lib/video-editor/transform";
import { DEFAULT_REVEAL_CONFIG, resolveRevealUnits, richFormattingAt } from "@/lib/video-editor/text-style";
import { computeTrackZIndex } from "@/lib/video-editor/track-stacking";
import { assignTrackSlots } from "@/lib/video-editor/track-slot-assignment";
import {
  computeDuckingMultiplier,
  computeFadeMultiplier,
  DEFAULT_AUDIO_PROPERTIES,
  isTrackAudible,
  pitchToPlaybackRateMultiplier,
  resolveVolume,
  type DuckingVoiceInterval,
} from "@/lib/video-editor/audio";
import {
  combineResolvedWithTransitionBlend,
  resolveAudioTransitionGain,
  resolveTransitionBlend,
  type TransitionLayerBlend,
} from "@/lib/video-editor/transition-engine";
import { clipEndMs, type AssetView, type ClipView, type TrackView, type TransitionView } from "../types";

// The compositor's actual layer-rendering logic (Module 3's Preview Window,
// extended by Modules 4/6/7/8/9) — extracted out of preview-window.tsx in
// Module 10 so it has exactly ONE implementation shared by both the live,
// interactive Preview Window and the headless Export render-mode route
// (render/render-workspace.tsx). This is the whole point of Module 10's
// "headless-browser frame-capture" architecture: an export is pixel-accurate
// to the live preview because it's the SAME React tree, not a second
// hand-rolled rendering engine re-deriving transform/keyframe/transition/
// text-reveal/audio math (which would drift from the preview over time —
// see PROJECT_STATUS.md's Module 10 entry). Nothing in this file may import
// from store.tsx or any other client-only-editor-state module — it must
// stay renderable from a plain `{playheadMs, playing, playbackRate}` prop
// triple so a render-mode caller with no Zustand store can use it too.
//
// Persistent media slots (2026-07-19) — real, severe bug found live: every
// VIDEO/AUDIO clip used to mount its OWN fresh <video>/<audio> DOM element
// (keyed by clip.id), each graphed into the shared Web Audio context via a
// brand-new createMediaElementSource() call. Confirmed with a real,
// reproducible measurement (see PROJECT_STATUS.md's own entry for the full
// evidence): the very FIRST such connection in a page session plays back
// perfectly, but every connection after that breaks the NEW element's own
// video decode clock — readyState stays at 4 (HAVE_ENOUGH_DATA, no
// buffering issue) while currentTime simply stops advancing on its own,
// and the app's existing drift-correction (see useSyncedMediaElement)
// silently papers over it with a hard seek roughly every 400ms, producing
// a near-continuous freeze-then-jump stutter for the rest of that clip's
// life — not a brief transition hiccup, ~88% of the clip's own duration.
// A controlled diagnostic (temporarily removing the graph connection
// entirely) dropped a dense scene-removal project's measured stutter from
// 12,076ms to 83ms across 8 clip boundaries, isolating the cause to the
// PER-CLIP reconnection itself, not clip-switch frequency, buffering, or a
// play()-promise race (zero rejected play() calls were ever observed).
//
// The fix: each VIDEO/AUDIO track now owns exactly 2 persistent elements
// ("slots"), created once and reused for every clip that ever plays on
// that track for the life of this CompositorStage instance —
// createMediaElementSource() is called AT MOST twice per track, ever, not
// once per clip. See useTrackSlotAssignment's own doc comment for the
// ping-pong assignment rule (it also transparently covers Module 9
// transition overlaps, which need exactly 2 simultaneously-active
// elements — the same 2 slots a track already has, no special-casing).
// IMAGE-asset clips on a VIDEO track are entirely unaffected — they never
// used a media element or the Web Audio graph, so they keep rendering via
// a plain, clip.id-keyed <img> exactly as before.

// ---------------------------------------------------------------------
// Shared Web Audio graph (Module 8 Part E) — one AudioContext per mounted
// CompositorStage instance's page, lazily created. In the live Preview
// Window this is resumed by the Play button's onClick (a real user
// gesture, satisfying browser autoplay policy); render mode never calls
// resumeSharedAudioContext() at all — it doesn't need live audio playback,
// since Module 10's audio track is bounced separately via
// OfflineAudioContext (lib/video-editor/audio-bounce.ts), not captured
// from this live graph.
// ---------------------------------------------------------------------
let sharedAudioContext: AudioContext | null = null;
function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

export function resumeSharedAudioContext() {
  if (sharedAudioContext && sharedAudioContext.state === "suspended") void sharedAudioContext.resume();
}

// Real incident (2026-07-22) — a live project's audio played fine on
// export but was completely silent in live preview, despite every
// media-element-level signal looking healthy (unpaused, currentTime
// advancing, gain applied). Root cause: resumeSharedAudioContext() was
// only ever called from the Preview Window's own mouse Play button
// (preview-window.tsx), never from the Timeline's Space-bar shortcut
// (timeline-panel.tsx) — a real user who starts playback via keyboard
// (the natural habit from every other video editor) gets a shared
// AudioContext that stays "suspended" for the rest of the page session:
// once an element is routed through createMediaElementSource(), its
// native output is entirely rerouted through that graph, so a suspended
// context means zero actual sound reaches the speakers no matter how
// healthy every other signal looks. Confirmed live via a real
// AudioContext.state check (Proxy-wrapped constructor, since the context
// is otherwise module-private here) — "suspended" even after the video's
// own currentTime was clearly advancing and its Web Audio gain was
// correctly set to 1.
//
// Fix: every "start playback" call site must resume audio in the SAME
// gesture that flips `playing` to true, not just the one call site that
// happened to remember it. Centralized here (next to
// resumeSharedAudioContext, the thing it's pairing with) rather than left
// as a convention callers must each remember — any future third call
// site reaches for this instead of raw `setPlaying(!playing)`.
export function togglePlayback(playing: boolean, setPlaying: (playing: boolean) => void) {
  if (!playing) resumeSharedAudioContext();
  setPlaying(!playing);
}

// Volume/pan/mute (Part E) need a real mixing graph — a bare <audio>/
// <video> element has no stereo-pan control at all, and gain alone could
// use the element's native .volume, but once ANY node graph exists for an
// element every other property of that element is routed through it
// instead (see the comment on `muted` below), so both go through the same
// graph for consistency. `createMediaElementSource` can only be called
// ONCE per element ever (the browser throws on a second call), so the
// nodes are created once (via the empty dep array + a ref guard) and
// reused for the lifetime of this component instance — which, since the
// 2026-07-19 persistent-slots fix, is now the lifetime of a TRACK's slot,
// not a single clip, so this only ever runs at most twice per track.
function useClipAudioGraph(elRef: React.RefObject<HTMLMediaElement | null>) {
  const nodesRef = React.useRef<{ source: MediaElementAudioSourceNode; gain: GainNode; panner: StereoPannerNode } | null>(null);

  React.useEffect(() => {
    const el = elRef.current;
    if (!el || nodesRef.current) return;
    try {
      const ctx = getSharedAudioContext();
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      source.connect(gain).connect(panner).connect(ctx.destination);
      nodesRef.current = { source, gain, panner };
    } catch {
      // Web Audio unavailable, or (defensively) this element was somehow
      // already graphed — falls back to the element's own native
      // volume/muted properties, see applyGain below.
    }

    // Real leak, found 2026-07-12 while diagnosing a headless-export crash
    // — disconnect on unmount releases the graph nodes instead of leaving
    // them permanently wired into ctx.destination. Since the 2026-07-19
    // persistent-slots fix, this now only fires when the owning TRACK is
    // removed or the whole CompositorStage unmounts, not on every clip
    // switch — the leak this originally guarded against (dozens of
    // orphaned per-clip nodes over a long export) can no longer happen at
    // all, since there are now at most 2 nodes per track for the track's
    // entire lifetime.
    return () => {
      const nodes = nodesRef.current;
      if (!nodes) return;
      nodes.source.disconnect();
      nodes.gain.disconnect();
      nodes.panner.disconnect();
      nodesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyGain(volume: number, pan: number, muted: boolean) {
    const nodes = nodesRef.current;
    const el = elRef.current;
    const effectiveGain = muted ? 0 : volume;
    if (nodes) {
      nodes.gain.gain.value = effectiveGain;
      nodes.panner.pan.value = pan;
    } else if (el) {
      // Fallback path only — .volume clamps to 1, so a >100% gain can't be
      // reproduced without the Web Audio graph above.
      el.volume = Math.min(1, effectiveGain);
      el.muted = muted;
    }
    // The actual output level lives inside the Web Audio graph's GainNode/
    // StereoPannerNode, which — unlike a plain <audio> element's own
    // .volume — isn't otherwise inspectable from outside this closure.
    // Mirrored onto the element as data-* attributes so devtools (and
    // automated verification) can confirm what's actually being applied
    // without reaching into React internals.
    if (el) {
      el.dataset.appliedGain = String(effectiveGain);
      el.dataset.appliedPan = String(pan);
    }
  }

  return applyGain;
}

// Buffering awareness (2026-07-23) — real, live-confirmed bug: live
// playback had ZERO awareness of whether a track's media was actually
// buffered ahead of the playhead. The RAF clock (preview-window.tsx) just
// advances playheadMs from wall-clock time regardless of what the
// underlying <video>/<audio> elements can actually deliver — under real
// network conditions slower than the source's bitrate (confirmed live:
// this exact app hit ~1.63MB/s R2 throughput against a ~1.14MB/s-minimum
// video, a wafer-thin margin), a struggling element falls behind, and the
// existing 0.4s drift-correction just hard-seeks it back on top of the
// runaway playhead — the visible result being a stuck/black frame (video
// with no decoded data yet to show) and/or audio that starts audibly late
// (a short clip's own buffer-fill time exceeding its whole on-screen
// window). No error, no explanation — it just silently looks broken.
//
// Fix: every persistent slot (video/audio tracks) and the OVERLAY track's
// muted b-roll video (see useMutedVideoSync below) report their own
// native buffering state — the browser's OWN `waiting`/`canplay`/
// `playing` events, not a bandwidth-estimation reimplementation — up
// through this context. CompositorStage aggregates every currently-
// reporting slot into one boolean and hands it to the live Preview
// Window via `onBufferingChange`, which pauses the RAF clock (freezing
// playheadMs, not just papering over the symptom with another seek) and
// shows a loading indicator until every slot clears. Deliberately a
// plain local React Context, not store.tsx — this file's own header
// forbids that import (render-mode has no store) — and `onBufferingChange`
// is optional precisely so render-mode can omit it entirely (export
// already has its own, different readiness mechanism —
// waitForAllVideosToSettle() in render-workspace.tsx — buffering-pause
// makes no sense for a frame-stepped headless capture).
const BufferingReportContext = React.createContext<((key: string, buffering: boolean) => void) | null>(null);

// Shared by useSyncedMediaElement (VIDEO/AUDIO persistent slots) and
// useMutedVideoSync (OVERLAY b-roll video) — every real media element
// that live playback depends on reports through the same mechanism.
// `active` gates whether this slot's reports count at all: an idle
// persistent slot (nothing currently assigned) must never hold the whole
// timeline hostage over ITS OWN stale/paused readyState.
function useReportBuffering<T extends HTMLMediaElement>(elRef: React.RefObject<T | null>, active: boolean) {
  const reportBuffering = React.useContext(BufferingReportContext);
  const key = React.useId();

  React.useEffect(() => {
    const el = elRef.current;
    if (!el || !reportBuffering || !active) {
      reportBuffering?.(key, false);
      return;
    }
    // `waiting` fires whenever the browser stalls playback for lack of
    // data — including the very first play() on a not-yet-buffered-enough
    // element, not just a mid-playback stall — so this one listener covers
    // both cases the user asked about ("low readyState" and "insufficient
    // buffered-ahead margin") via the browser's own real detection of them,
    // rather than a hand-rolled readyState/buffered-margin poll.
    function onWaiting() {
      reportBuffering!(key, true);
    }
    function onReady() {
      reportBuffering!(key, false);
    }
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("canplay", onReady);
    el.addEventListener("playing", onReady);
    return () => {
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("playing", onReady);
      // Always clear on unmount/deactivation — a slot that goes idle or
      // unmounts mid-stall must never leave the aggregate stuck "buffering"
      // forever with no element left to ever fire canplay/playing again.
      reportBuffering!(key, false);
    };
  }, [elRef, reportBuffering, active, key]);
}

// `clip` is now nullable (2026-07-19) — a persistent slot with nothing
// currently assigned to it (see useTrackSlotAssignment) still renders a
// real, mounted element (that's the whole point — it must stay ready to
// be reused without a fresh createMediaElementSource call), it just has
// no clip to sync against: paused, left alone otherwise.
function useSyncedMediaElement<T extends HTMLMediaElement>(
  elRef: React.RefObject<T | null>,
  clip: ClipView | null,
  playheadMs: number,
  playing: boolean,
  playbackRate: number,
  preservesPitch: boolean,
  audio: { volume: number; pan: number; muted: boolean }
) {
  const applyGain = useClipAudioGraph(elRef);
  // Only report while genuinely trying to play something real — a paused/
  // scrubbed slot showing a momentarily-stale frame is pre-existing,
  // expected behavior (the drift-correction effect below already forces
  // it to the right position), not the live-playback stall this exists
  // to catch.
  useReportBuffering(elRef, clip !== null && playing);
  // Tracks which clip.id this slot was last synced against — lets a
  // FRESH assignment (a different clip just took over this persistent
  // slot, its `src` changing via the JSX below) always force an
  // immediate seek, the same way a brand-new mount always used to,
  // rather than waiting for the ordinary 0.4s drift threshold (which is
  // for an already-playing clip falling behind, not a slot reassignment
  // where currentTime just reset to 0 along with the new source).
  const lastSyncedClipIdRef = React.useRef<string | null>(null);
  const sourceTimeSeconds = clip ? (clip.trimStartMs + (playheadMs - clip.startMs)) / 1000 : 0;

  // Assignment + play/pause-state effect — fires ONLY on a genuine
  // transition (a different clip just took over this slot, `playing`
  // itself flipped, or playbackRate/pitch changed), never on every
  // playhead tick. Bug found live 2026-07-19: `sourceTimeSeconds` used to
  // sit in this same effect's dependency array, and since it's derived
  // from `playheadMs` (which updates on every requestAnimationFrame tick
  // — ~60/sec — while playing), the WHOLE effect re-ran every tick,
  // including the `el.play()` call below — measured calling play() on an
  // already-playing element ~60x/sec, a real, independent contributor to
  // visible stutter on demanding source files. The still-continuous
  // drift-correction (which genuinely does need to re-check every tick)
  // is split into its own effect below, which only ever touches
  // `currentTime`, never play()/pause() — those stay owned exclusively
  // here, firing only on a real state change.
  React.useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!clip) {
      // Idle — nothing assigned to this slot right now. Pause and leave
      // whatever frame/audio is currently loaded alone; a new clip may
      // reuse this exact slot moments later (e.g. the far side of a gap,
      // or the next iteration of a ping-pong reassignment).
      el.pause();
      lastSyncedClipIdRef.current = null;
      return;
    }
    el.playbackRate = playbackRate;
    // Module 8 — pitch shift (Part B) is applied by resampling
    // (preservesPitch=false + a playbackRate multiplier derived from
    // semitones), the same mechanism a plain speed change uses — real
    // browsers have no independent, speed-decoupled pitch-shift primitive
    // without a phase-vocoder DSP library (none installed in this
    // project). preservesPitch stays true (the default, correct behavior)
    // whenever pitch is untouched, so an ordinary speed change never
    // distorts pitch — see PROJECT_STATUS.md's Module 8 entry for the full
    // trade-off (combining a non-default speed AND a non-default pitch on
    // the same clip isn't independently correct in live preview).
    const mediaEl = el as HTMLMediaElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
    mediaEl.preservesPitch = preservesPitch;
    mediaEl.mozPreservesPitch = preservesPitch;
    mediaEl.webkitPreservesPitch = preservesPitch;
    const isNewAssignment = lastSyncedClipIdRef.current !== clip.id;
    lastSyncedClipIdRef.current = clip.id;
    if (isNewAssignment) {
      // currentTime resets to 0 when `src` changes — always force an
      // immediate seek on a fresh assignment rather than waiting for the
      // drift effect's next tick.
      el.currentTime = sourceTimeSeconds;
    }
    if (playing) void el.play().catch(() => {});
    else el.pause();
    // sourceTimeSeconds is intentionally excluded below: it changes every
    // RAF tick while playing, and this effect must NOT re-run on every
    // tick (that's the bug being fixed). Read fresh from the closure only
    // when a real trigger above fires; the continuous per-tick check
    // lives in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elRef, clip, playing, playbackRate, preservesPitch]);

  // Continuous drift-correction — the one piece of the old effect that
  // genuinely does need to re-run on every playhead tick. Never calls
  // play()/pause() — see the effect above for why that split matters.
  React.useEffect(() => {
    const el = elRef.current;
    if (!el || !clip) return;
    if (!playing) {
      // Paused — always snap exactly to the current scrub/playhead
      // position (no threshold), matching the old unconditional
      // `!playing` branch. Only fires when playheadMs actually changes
      // (e.g. scrubbing while paused), not on a 60/sec loop, since the
      // playback RAF loop itself doesn't run while paused.
      el.currentTime = sourceTimeSeconds;
      return;
    }
    const drift = Math.abs(el.currentTime - sourceTimeSeconds);
    if (drift > 0.4) el.currentTime = sourceTimeSeconds;
  }, [elRef, clip, playing, sourceTimeSeconds]);

  React.useEffect(() => {
    if (!clip) return;
    applyGain(audio.volume, audio.pan, audio.muted);
  }, [applyGain, clip, audio.volume, audio.pan, audio.muted]);
}

interface VideoSlotDescriptor {
  clip: ClipView;
  asset: AssetView;
  zIndex: number;
  css: { transform: string; clipPath: string; opacity: number; mixBlendMode: BlendMode };
  filter?: string;
  muted: boolean;
}

interface AudioSlotDescriptor {
  clip: ClipView;
  asset: AssetView;
  muted: boolean;
  gainMultiplier: number;
}

// React wrapper around assignTrackSlots (lib/video-editor/
// track-slot-assignment.ts — extracted there, same convention as
// track-stacking.ts, so the assignment algorithm itself is unit-testable
// without mounting a React component). Keeps the previous assignment
// in a ref across renders and resolves the returned ids back to their
// full descriptors.
function useTrackSlotAssignment<D extends { clip: ClipView }>(activeDescriptors: D[]): [D | null, D | null] {
  const prevRef = React.useRef<[string | null, string | null]>([null, null]);
  const activeIds = activeDescriptors.map((d) => d.clip.id);
  const [slot0Id, slot1Id] = assignTrackSlots(activeIds, prevRef.current);
  prevRef.current = [slot0Id, slot1Id];

  const slot0 = slot0Id ? (activeDescriptors.find((d) => d.clip.id === slot0Id) ?? null) : null;
  const slot1 = slot1Id ? (activeDescriptors.find((d) => d.clip.id === slot1Id) ?? null) : null;
  return [slot0, slot1];
}

// A VIDEO clip's own embedded audio isn't independently editable this
// module (no volume/pan/fade/pitch/speed content fields for VIDEO clips —
// see right-properties-panel.tsx's comment) — only mute/solo (via the
// `muted` prop, already resolved by the caller) apply here. Still goes
// through the Web Audio graph (not the native `muted` attribute) so a
// solo elsewhere in the project can silence this clip's audio: once ANY
// element on the page has been graphed via createMediaElementSource, that
// graph is the only reliable place left to control gain project-wide.
// `descriptor` is null for an idle slot — still a real, mounted <video>
// (see this file's header), just invisible and paused.
function PersistentVideoSlot({
  descriptor,
  playheadMs,
  playing,
  playbackRate,
}: {
  descriptor: VideoSlotDescriptor | null;
  playheadMs: number;
  playing: boolean;
  playbackRate: number;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  useSyncedMediaElement(videoRef, descriptor?.clip ?? null, playheadMs, playing, playbackRate, true, {
    volume: 1,
    pan: 0,
    muted: descriptor?.muted ?? true,
  });

  // Real bug found live (2026-07-21, launch-readiness audit) — this
  // element had no error handling at all: a source that fails to load
  // (confirmed live: a real founder asset whose underlying file had gone
  // missing from storage, a real HTTP 404) rendered as a silent black
  // frame with zero explanation, indistinguishable from "nothing selected"
  // or "still loading" — the exact same "silent failure, no visual
  // explanation" class of bug already fixed once for the Uploads panel's
  // FAILED-status assets, never applied here. Tracked per CLIP ID, not
  // just a bare boolean: this same DOM element is reused across many
  // different clips over its lifetime (the whole point of the 2-slot
  // persistent-element architecture above), so an error against clip A
  // must never keep showing once a genuinely different clip B is
  // assigned to this slot and loads fine.
  const [erroredClipId, setErroredClipId] = React.useState<string | null>(null);
  // Real bug fix (2026-07-24, found live during the codebase health check)
  // — a clip whose source upload genuinely failed (local-instant-preview's
  // own background-upload catch path, queries.ts) is now marked
  // asset.status FAILED for real; surfacing that directly here means the
  // preview shows the real reason immediately rather than waiting on the
  // <video> element to attempt a real network request against a URL that
  // may not even exist yet and fail on its own.
  const assetUploadFailed = descriptor?.asset.status === "FAILED";
  const hasError = descriptor != null && (erroredClipId === descriptor.clip.id || assetUploadFailed);

  return (
    <>
      <video
        ref={videoRef}
        data-clip-id={descriptor?.clip.id ?? ""}
        data-slot-idle={descriptor ? undefined : "true"}
        src={descriptor?.asset.url}
        // Real bug found live (2026-07-23) — this element is routed through
        // useClipAudioGraph's createMediaElementSource() (Module 8's mixing
        // graph), and R2-hosted media is cross-origin from this app's own
        // domain. Without crossOrigin set, Chromium treats the resulting
        // MediaElementAudioSourceNode as tainted and silently outputs ZERO
        // samples through the Web Audio graph — confirmed live via the
        // browser's own console message ("MediaElementAudioSource outputs
        // zeroes due to CORS access restrictions") — while every other
        // signal (paused, currentTime, readyState, appliedGain) looks
        // completely healthy, since native playback itself was never
        // blocked, only the Web-Audio-routed output. R2's public domain
        // already sends a correct Access-Control-Allow-Origin header on GET
        // (confirmed live via curl) — the browser just never asked for it
        // in CORS mode without this attribute.
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-contain"
        style={
          descriptor
            ? {
                zIndex: descriptor.zIndex,
                transform: descriptor.css.transform,
                clipPath: descriptor.css.clipPath,
                opacity: hasError ? 0 : descriptor.css.opacity,
                mixBlendMode: descriptor.css.mixBlendMode,
                filter: descriptor.filter,
              }
            : { zIndex: -1, opacity: 0, pointerEvents: "none" }
        }
        playsInline
        onError={() => {
          if (descriptor) setErroredClipId(descriptor.clip.id);
        }}
        onLoadStart={() => {
          // A fresh load attempt starting (new src, including a retry of
          // the same clip) clears any stale error for THIS slot — never
          // clears a DIFFERENT clip's error state, since that clip isn't
          // the one that just started loading.
          if (descriptor && erroredClipId === descriptor.clip.id) setErroredClipId(null);
        }}
      />
      {hasError && descriptor && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-center"
          style={{ zIndex: descriptor.zIndex }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-8 text-editor-danger">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          <p className="max-w-[80%] text-body-sm text-white">{assetUploadFailed ? "This clip's upload failed." : "This video failed to load."}</p>
          <p className="max-w-[80%] text-micro text-neutral-400">
            {assetUploadFailed ? "Remove this clip and try uploading the file again." : "The source file may be missing. Try re-uploading it."}
          </p>
        </div>
      )}
    </>
  );
}

// Invisible — plays the clip's audio in sync with the same playhead clock;
// nothing to render visually, so Module 4's transform doesn't apply here.
// Module 8 (Part E) — volume/fade/pan/pitch/speed/mute-via-solo all
// resolved by the caller (the main render loop, which has the clip's
// `content` and the project's full track list for solo logic) and applied
// live here through useSyncedMediaElement's Web Audio graph. Module 9 adds
// `gainMultiplier` — a simple linear crossfade during an AUDIO track's
// transition overlap (1 outside any transition), multiplied on top of the
// clip's own volume/fade so both compose rather than one replacing the
// other. `descriptor` is null for an idle slot, same convention as
// PersistentVideoSlot above.
function PersistentAudioSlot({
  descriptor,
  playheadMs,
  playing,
  playbackRate,
}: {
  descriptor: AudioSlotDescriptor | null;
  playheadMs: number;
  playing: boolean;
  playbackRate: number;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const atMs = descriptor ? playheadMs - descriptor.clip.startMs : 0;
  const content = descriptor?.clip.content ?? {};
  const volumeBase = resolveVolume(content.volume ?? DEFAULT_AUDIO_PROPERTIES.volume, atMs);
  const fadeMultiplier = descriptor
    ? computeFadeMultiplier(
        atMs,
        descriptor.clip.durationMs,
        content.fadeInMs ?? DEFAULT_AUDIO_PROPERTIES.fadeInMs,
        content.fadeOutMs ?? DEFAULT_AUDIO_PROPERTIES.fadeOutMs
      )
    : 1;
  const pan = content.pan ?? DEFAULT_AUDIO_PROPERTIES.pan;
  const pitchSemitones = content.pitchSemitones ?? DEFAULT_AUDIO_PROPERTIES.pitchSemitones;
  const speed = content.speed ?? DEFAULT_AUDIO_PROPERTIES.speed;
  const preservesPitch = pitchSemitones === 0;
  const effectivePlaybackRate = playbackRate * speed * (preservesPitch ? 1 : pitchToPlaybackRateMultiplier(pitchSemitones));

  useSyncedMediaElement(audioRef, descriptor?.clip ?? null, playheadMs, playing, effectivePlaybackRate, preservesPitch, {
    volume: volumeBase * fadeMultiplier * (descriptor?.gainMultiplier ?? 1),
    pan,
    muted: descriptor?.muted ?? true,
  });

  // crossOrigin="anonymous" — same CORS-taint fix as the VIDEO slot above
  // (see its own comment); this AUDIO slot goes through the identical
  // useClipAudioGraph/createMediaElementSource path and is just as
  // silently zeroed without it.
  return (
    <audio ref={audioRef} data-clip-id={descriptor?.clip.id ?? ""} data-slot-idle={descriptor ? undefined : "true"} src={descriptor?.asset.url} crossOrigin="anonymous" />
  );
}

// One track's persistent 2-slot pool — see useTrackSlotAssignment's own
// doc comment for the assignment rule. Rendered ONCE per VIDEO track,
// keyed by track.id (stable across every clip that ever plays on it),
// never by clip.id.
function VideoTrackSlots({
  descriptors,
  playheadMs,
  playing,
  playbackRate,
}: {
  descriptors: VideoSlotDescriptor[];
  playheadMs: number;
  playing: boolean;
  playbackRate: number;
}) {
  const [slot0, slot1] = useTrackSlotAssignment(descriptors);
  return (
    <>
      <PersistentVideoSlot descriptor={slot0} playheadMs={playheadMs} playing={playing} playbackRate={playbackRate} />
      <PersistentVideoSlot descriptor={slot1} playheadMs={playheadMs} playing={playing} playbackRate={playbackRate} />
    </>
  );
}

// Same idea as VideoTrackSlots, for AUDIO-kind tracks.
function AudioTrackSlots({
  descriptors,
  playheadMs,
  playing,
  playbackRate,
}: {
  descriptors: AudioSlotDescriptor[];
  playheadMs: number;
  playing: boolean;
  playbackRate: number;
}) {
  const [slot0, slot1] = useTrackSlotAssignment(descriptors);
  return (
    <>
      <PersistentAudioSlot descriptor={slot0} playheadMs={playheadMs} playing={playing} playbackRate={playbackRate} />
      <PersistentAudioSlot descriptor={slot1} playheadMs={playheadMs} playing={playing} playbackRate={playbackRate} />
    </>
  );
}

// Real bug found live (2026-07-22) — a b-roll clip (a VIDEO-kind asset,
// exactly what ai-timeline-translator.ts's TASK 3 broll handling places on
// an OVERLAY track) silently fell through to the plain "Overlay" text
// placeholder below, no matter how valid/fetchable its real asset URL was
// — OverlayLayer only ever special-cased asset?.kind === "IMAGE" (a real
// sticker), never VIDEO. Confirmed live: the clip, its resolved asset
// (status READY, a real Coverr video), and the playhead position were all
// correct — only the RENDERER had no video branch at all.
//
// Deliberately NOT routed through useSyncedMediaElement/useClipAudioGraph
// (the persistent-slot Web Audio machinery VIDEO/AUDIO tracks use — see
// this file's header) — that exists to avoid re-calling
// createMediaElementSource() on every clip switch, which only matters for
// elements that need real audio output. A b-roll overlay is muted by
// design (OVERLAY's own `content` schema has no volume/pan fields at all —
// see EditorClip's doc comment, prisma/schema.prisma) — visual-only, so it
// never needs a Web Audio graph connection, and OVERLAY already
// remounts per clip switch (never through the persistent-slot pool), so a
// plain muted <video> carries none of that bug's risk.
function useMutedVideoSync(elRef: React.RefObject<HTMLVideoElement | null>, clip: ClipView, playheadMs: number, playing: boolean, playbackRate: number) {
  const sourceTimeSeconds = (clip.trimStartMs + (playheadMs - clip.startMs)) / 1000;
  // Same buffering-report mechanism as useSyncedMediaElement — a slow-to-
  // load b-roll cutaway must pause the whole timeline too, not just play
  // silently-wrong/late (see BufferingReportContext's own doc comment).
  useReportBuffering(elRef, playing);

  // Same two-effect split as useSyncedMediaElement, same reason (2026-07-19
  // bug: sourceTimeSeconds in this effect's deps re-ran play() ~60x/sec
  // while playing) — assignment/play-pause fires only on a real state
  // change, continuous drift-correction never calls play()/pause().
  React.useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
    el.currentTime = sourceTimeSeconds;
    if (playing) void el.play().catch(() => {});
    else el.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elRef, clip.id, playing, playbackRate]);

  React.useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!playing) {
      el.currentTime = sourceTimeSeconds;
      return;
    }
    const drift = Math.abs(el.currentTime - sourceTimeSeconds);
    if (drift > 0.4) el.currentTime = sourceTimeSeconds;
  }, [elRef, playing, sourceTimeSeconds]);
}

// OVERLAY/TEXT compose Module 4's transform ON TOP of their own
// content-based placement rather than replacing it (see the file header):
// content's translate(-50%,-50%) + its own scale/rotate establishes where
// the element sits and its native size; Module 4's translate/rotate/scale
// stack as additional adjustments after that, and opacity multiplies.
function OverlayLayer({
  clip,
  asset,
  zIndex,
  moduleFourCss,
  filter,
  playheadMs,
  playing,
  playbackRate,
}: {
  clip: ClipView;
  asset: AssetView | null;
  zIndex: number;
  moduleFourCss: { transform: string; clipPath: string; opacity: number; mixBlendMode: BlendMode };
  filter?: string;
  playheadMs: number;
  playing: boolean;
  playbackRate: number;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  // Always called (rules of hooks) — a no-op when this clip isn't a VIDEO
  // asset, since videoRef.current stays null (nothing rendered assigns it).
  useMutedVideoSync(videoRef, clip, playheadMs, playing, playbackRate);

  // No explicit placement (clip.content is null) is the real, current
  // b-roll case — ai-timeline-translator.ts never sets x/y/scale for a
  // broll clip (only assetId/startMs/durationMs) — and b-roll is meant to
  // visually cover the frame as a cutaway, not sit in a small centered
  // sticker-style box. An explicit content.x/y/scale (a hypothetical
  // future manually-repositioned VIDEO overlay) is still honored below,
  // same as any sticker.
  //
  // Bug fix (2026-07-23) — this full-frame treatment only checked
  // asset?.kind === "VIDEO", so an IMAGE-kind b-roll result fell through
  // to the generic small-centered-sticker path below (max-h-40/max-w-40,
  // dead-center) instead — on a talking-head video that lands directly on
  // the speaker's face. B1's relevance re-ranking (same day) made this a
  // real, regularly-hit case: a well-matched stock IMAGE can now
  // legitimately outscore a weakly-relevant VIDEO for the same query,
  // where previously VIDEO almost always won regardless of fit. B-roll
  // should get the same full-frame cutaway treatment whether the resolved
  // asset happens to be a video or a still image — the "cutaway, not a
  // sticker" intent above doesn't depend on which kind won.
  if ((asset?.kind === "VIDEO" || asset?.kind === "IMAGE") && clip.content == null) {
    const sharedStyle: React.CSSProperties = {
      zIndex,
      transform: moduleFourCss.transform,
      clipPath: moduleFourCss.clipPath,
      opacity: moduleFourCss.opacity,
      mixBlendMode: moduleFourCss.mixBlendMode,
      filter,
    };
    if (asset.kind === "IMAGE") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img data-clip-id={clip.id} src={asset.url} alt="" className="absolute inset-0 h-full w-full object-cover" style={sharedStyle} />
      );
    }
    return (
      <video
        ref={videoRef}
        data-clip-id={clip.id}
        src={asset.url}
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={sharedStyle}
      />
    );
  }

  const content = clip.content ?? {};
  const x = (content.x ?? 0.5) * 100;
  const y = (content.y ?? 0.5) * 100;
  const scale = content.scale ?? 1;
  const rotation = content.rotation ?? 0;
  const opacity = (content.opacity ?? 1) * moduleFourCss.opacity;

  return (
    <div
      data-clip-id={clip.id}
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg) ${moduleFourCss.transform}`,
        clipPath: moduleFourCss.clipPath,
        opacity,
        mixBlendMode: moduleFourCss.mixBlendMode,
        zIndex,
        filter,
      }}
    >
      {asset?.kind === "IMAGE" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt="" className="max-h-40 max-w-40 object-contain" />
      ) : asset?.kind === "VIDEO" ? (
        <video ref={videoRef} src={asset.url} muted playsInline className="max-h-40 max-w-40 object-contain" />
      ) : (
        <div className="rounded bg-white/20 px-3 py-2 text-caption text-white">Overlay</div>
      )}
    </div>
  );
}

// Module 7 — the shared TEXT/SUBTITLE renderer. Every style field is
// optional and falls back to a sane default, matching Module 4's
// established "content is a superset-of-fields Json blob" convention.
// Gradient fill uses `background-clip: text` (overrides plain `color`);
// stroke uses `-webkit-text-stroke` (see ClipContent's doc comment for why
// this app doesn't have a separate "outline" property — they render
// identically here); glow is stacked zero-offset `text-shadow` layers
// (visually distinct from Shadow's single directional one). Reveal
// (word/character/karaoke) is resolved fresh every call via
// resolveRevealUnits() — this component re-renders every playheadMs
// change (live rAF ticks OR a render-mode frame step), so reveal timing
// is correct either way with no additional wiring.
function TextLayer({
  clip,
  zIndex,
  moduleFourCss,
  playheadMs,
  isSubtitle,
  filter,
}: {
  clip: ClipView;
  zIndex: number;
  moduleFourCss: { transform: string; clipPath: string; opacity: number; mixBlendMode: BlendMode };
  playheadMs: number;
  isSubtitle: boolean;
  filter?: string;
}) {
  const content = clip.content ?? {};
  const x = (content.x ?? 0.5) * 100;
  const y = (content.y ?? 0.85) * 100;
  const text = content.text ?? "";
  const atMs = playheadMs - clip.startMs;

  const reveal = content.reveal ?? DEFAULT_REVEAL_CONFIG;
  const revealUnits = resolveRevealUnits(text, reveal, atMs);

  const textShadowLayers: string[] = [];
  if (content.shadowColor) {
    textShadowLayers.push(`${content.shadowOffsetX ?? 2}px ${content.shadowOffsetY ?? 2}px ${content.shadowBlur ?? 4}px ${content.shadowColor}`);
  }
  if (content.glowColor) {
    const blur = content.glowBlur ?? 8;
    const intensity = Math.max(1, Math.round(content.glowIntensity ?? 2));
    for (let i = 1; i <= intensity; i++) {
      textShadowLayers.push(`0 0 ${blur * i}px ${content.glowColor}`);
    }
  }

  const hasGradient = (content.gradientColors?.length ?? 0) >= 2;
  const baseTextStyle: React.CSSProperties = {
    fontFamily: content.fontFamily ?? "inherit",
    fontSize: content.fontSize ? `${content.fontSize}px` : "24px",
    fontWeight: content.fontWeight ?? 400,
    letterSpacing: content.letterSpacing ? `${content.letterSpacing}px` : undefined,
    lineHeight: content.lineHeight ?? 1.3,
    color: hasGradient ? undefined : (content.color ?? "#ffffff"),
    ...(hasGradient
      ? {
          backgroundImage: `linear-gradient(${content.gradientAngleDeg ?? 90}deg, ${content.gradientColors!.join(", ")})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }
      : {}),
    ...(content.strokeColor ? { WebkitTextStroke: `${content.strokeWidth ?? 1}px ${content.strokeColor}`, paintOrder: "stroke fill" } : {}),
    textShadow: textShadowLayers.length > 0 ? textShadowLayers.join(", ") : undefined,
  };

  return (
    <div
      data-clip-id={clip.id}
      className="absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-wrap text-center"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) ${moduleFourCss.transform}`,
        opacity: moduleFourCss.opacity,
        mixBlendMode: moduleFourCss.mixBlendMode,
        zIndex,
        filter,
      }}
    >
      {isSubtitle && content.speaker && content.showSpeakerInOutput && (
        <div className="mb-1 text-[0.7em] font-semibold uppercase tracking-wide text-white/70">{content.speaker}</div>
      )}
      <span style={baseTextStyle}>
        {revealUnits.map((unit, i) => {
          if (unit.isWhitespace) return <React.Fragment key={i}>{unit.text}</React.Fragment>;

          const { bold, italic, underline } = richFormattingAt(content.richRuns, unit.charStart, unit.charEnd);
          const runStyle: React.CSSProperties = {
            fontWeight: bold ? 700 : undefined,
            fontStyle: italic ? "italic" : undefined,
            textDecoration: underline ? "underline" : undefined,
          };

          if (reveal.mode === "KARAOKE") {
            return (
              <span key={i} style={{ ...runStyle, color: unit.isCurrent ? reveal.highlightColor : undefined }}>
                {unit.text}
              </span>
            );
          }
          if (reveal.mode === "NONE") {
            return (
              <span key={i} style={runStyle}>
                {unit.text}
              </span>
            );
          }
          // WORD / CHARACTER — FADE or POP reveal.
          const revealStyle: React.CSSProperties =
            reveal.style === "POP"
              ? { opacity: unit.progress, display: "inline-block", transform: `scale(${0.5 + 0.5 * unit.progress})` }
              : { opacity: unit.progress };
          return (
            <span key={i} style={{ ...runStyle, ...revealStyle }}>
              {unit.text}
            </span>
          );
        })}
      </span>
    </div>
  );
}

// The shared render-loop entry point. Renders every visible track's active
// clip layer(s) for the given playheadMs — used unchanged by both
// PreviewWindow (live) and RenderWorkspace (headless export). Deliberately
// renders ONLY the layer stack, not a sized/positioned stage wrapper div —
// each caller owns its own stage sizing (PreviewWindow's is responsive/
// aspect-ratio-based; RenderWorkspace's is an exact pixel size matching the
// export resolution), since that's presentation, not compositor logic.
export function CompositorStage({
  tracks,
  clips,
  transitions,
  assetById,
  playheadMs,
  playing,
  playbackRate,
  effectiveTransform,
  onBufferingChange,
}: {
  tracks: TrackView[];
  clips: ClipView[];
  transitions: TransitionView[];
  assetById: Map<string, AssetView>;
  playheadMs: number;
  playing: boolean;
  playbackRate: number;
  // Live-drag override hook (Module 4's liveClipOverride) — render mode
  // has no such concept and simply omits this, falling back to the clip's
  // own server-confirmed transform.
  effectiveTransform?: (clip: ClipView) => ClipTransform | null;
  // Buffering awareness (2026-07-23) — optional and omitted entirely by
  // render mode (render-workspace.tsx has its own, different readiness
  // mechanism — see BufferingReportContext's own doc comment). The live
  // Preview Window passes this to pause its RAF clock and show a loading
  // indicator whenever any active media slot reports it isn't buffered
  // enough to play forward.
  onBufferingChange?: (isBuffering: boolean) => void;
}) {
  // Aggregates every currently-reporting slot's key into one Set — the
  // aggregate boolean only actually changes (and only then calls
  // onBufferingChange) when the Set transitions empty<->non-empty, not on
  // every individual slot's report.
  const bufferingSlotsRef = React.useRef<Set<string>>(new Set());
  const reportBuffering = React.useCallback(
    (key: string, buffering: boolean) => {
      const set = bufferingSlotsRef.current;
      const wasEmpty = set.size === 0;
      if (buffering) set.add(key);
      else set.delete(key);
      const isEmptyNow = set.size === 0;
      if (wasEmpty !== isEmptyNow) onBufferingChange?.(!isEmptyNow);
    },
    [onBufferingChange]
  );

  const anyTrackSoloed = tracks.some((t) => t.soloed);
  const orderedVisibleTracks = React.useMemo(() => [...tracks].filter((t) => !t.isHidden).sort((a, b) => a.order - b.order), [tracks]);
  const resolveTransform = effectiveTransform ?? ((clip: ClipView) => clip.transform);

  // Audio Ducking (2026-07-15) — for every AUDIO track with ducking
  // enabled, resolve its CURRENT target voice-clip windows from the live
  // `tracks`/`clips` lists (re-derived every render, so a dragged/trimmed/
  // deleted voice clip is reflected immediately — never a baked curve
  // that could go stale). A muted or soloed-out voice track's clips don't
  // count (isTrackAudible), matching "duck under audible voice," not
  // "duck under any clip on a track tagged voice regardless of whether
  // you can actually hear it."
  const voiceIntervalsByTrackId = React.useMemo(() => {
    const map = new Map<string, DuckingVoiceInterval[]>();
    for (const track of tracks) {
      if (track.kind !== "AUDIO" || !track.duckingEnabled) continue;
      const targetVoiceTrackIds =
        track.duckingVoiceTrackIds.length > 0 ? track.duckingVoiceTrackIds : tracks.filter((t) => t.audioSubtype === "VOICE").map((t) => t.id);
      const audibleVoiceTrackIds = new Set(
        targetVoiceTrackIds.filter((id) => {
          const voiceTrack = tracks.find((t) => t.id === id);
          return voiceTrack ? isTrackAudible(voiceTrack, anyTrackSoloed) : false;
        })
      );
      const intervals = clips
        .filter((c) => audibleVoiceTrackIds.has(c.trackId) && c.assetId)
        .map((c) => ({ startMs: c.startMs, endMs: clipEndMs(c) }));
      map.set(track.id, intervals);
    }
    return map;
  }, [tracks, clips, anyTrackSoloed]);

  // Module 9 — normally 0 or 1 clip; DURING a transition's overlap window
  // this returns 2 (clipA's tail hasn't ended yet, clipB's head has already
  // started — see transition-engine.ts's file header for the ripple-shift
  // that makes that true).
  function activeClipsOnTrack(trackId: string): ClipView[] {
    return clips.filter((c) => c.trackId === trackId && playheadMs >= c.startMs && playheadMs < clipEndMs(c));
  }

  // Resolves ONE clip's transform/blend CSS — shared by both the
  // persistent-slot descriptor builders below and renderClipLayer (for
  // the track kinds that still render per-clip: OVERLAY/TEXT/SUBTITLE,
  // and IMAGE-asset clips on a VIDEO track, none of which were ever part
  // of the persistent-slots fix).
  function resolveClipCss(clip: ClipView, blend: TransitionLayerBlend | null) {
    const resolvedBase = resolveClipTransform(resolveTransform(clip), playheadMs - clip.startMs);
    const resolved = blend ? combineResolvedWithTransitionBlend(resolvedBase, blend) : resolvedBase;
    const css = composeTransformCss(resolved);
    const filter = blend && blend.blurPx > 0.05 ? `blur(${blend.blurPx}px)` : undefined;
    return { css, filter };
  }

  // Module 9 — renders ONE clip's layer for its track, optionally blended
  // with a transition contribution — the dispatch point for every track
  // kind that still renders per-clip (OVERLAY/TEXT/SUBTITLE; VIDEO tracks
  // route through this only for an IMAGE-asset clip). VIDEO/AUDIO-asset
  // clips are handled separately by renderMediaTrack below (persistent
  // slots, not per-clip mounting — see this file's header).
  function renderClipLayer(track: TrackView, clip: ClipView, zIndex: number, blend: TransitionLayerBlend | null): React.ReactNode {
    const asset = clip.assetId ? (assetById.get(clip.assetId) ?? null) : null;
    const { css, filter } = resolveClipCss(clip, blend);

    if (track.kind === "VIDEO" && asset?.kind === "IMAGE") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={clip.id}
          data-clip-id={clip.id}
          src={asset.url}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
          style={{ zIndex, transform: css.transform, clipPath: css.clipPath, opacity: css.opacity, mixBlendMode: css.mixBlendMode, filter }}
        />
      );
    }
    if (track.kind === "OVERLAY") {
      return (
        <OverlayLayer
          key={clip.id}
          clip={clip}
          asset={asset}
          zIndex={zIndex}
          moduleFourCss={css}
          filter={filter}
          playheadMs={playheadMs}
          playing={playing}
          playbackRate={playbackRate}
        />
      );
    }
    // Module 7 — TEXT and SUBTITLE share the exact same rendering engine
    // (font/gradient/stroke/shadow/glow/rich-runs/reveal) — the only
    // difference is SUBTITLE additionally honors `content.speaker`/
    // `showSpeakerInOutput`, so one component covers both rather than
    // duplicating the render logic.
    if (track.kind === "TEXT" || track.kind === "SUBTITLE") {
      return (
        <TextLayer key={clip.id} clip={clip} zIndex={zIndex} moduleFourCss={css} playheadMs={playheadMs} isSubtitle={track.kind === "SUBTITLE"} filter={filter} />
      );
    }
    // EFFECTS — no renderer yet; intentionally rendered as nothing rather
    // than a crash. (VIDEO-track VIDEO-asset / AUDIO-track AUDIO-asset
    // clips never reach here — see renderMediaTrack.)
    return null;
  }

  // Builds this VIDEO/AUDIO track's persistent-slot descriptors for
  // whichever clips are currently active (0, 1, or 2), and renders its
  // 2-slot pool once — see this file's header and useTrackSlotAssignment
  // for the full design. A VIDEO track's IMAGE-asset clips are filtered
  // OUT here and rendered separately via the ordinary per-clip
  // renderClipLayer path instead (untouched by this fix).
  function renderMediaTrack(track: TrackView, active: ClipView[], baseZ: number): React.ReactNode {
    const sorted = [...active].sort((a, b) => a.startMs - b.startMs);
    const transition =
      sorted.length > 1 ? transitions.find((t) => t.trackId === track.id && t.clipAId === sorted[0].id && t.clipBId === sorted[1].id) : undefined;
    // An overlap with no transition backing it (e.g. two clips manually
    // dragged on top of each other) falls back to "later clip wins," the
    // same behavior this compositor had before Module 9 — only clipB
    // gets a descriptor.
    const effectiveActive = sorted.length > 1 && !transition ? [sorted[1]] : sorted;
    const t = transition ? (playheadMs - sorted[1].startMs) / transition.durationMs : 0;

    if (track.kind === "VIDEO") {
      const imageClips = effectiveActive.filter((c) => c.assetId && assetById.get(c.assetId)?.kind === "IMAGE");
      const videoClips = effectiveActive.filter((c) => c.assetId && assetById.get(c.assetId)?.kind === "VIDEO");
      const descriptors: VideoSlotDescriptor[] = videoClips.map((clip, i) => {
        const asset = assetById.get(clip.assetId!)!;
        const isClipA = transition && clip.id === sorted[0].id;
        const isClipB = transition && clip.id === sorted[1].id;
        const blend = transition ? resolveTransitionBlend(transition.type, transition.direction, transition.easing, t) : null;
        const { css, filter } = resolveClipCss(clip, isClipA ? blend?.a ?? null : isClipB ? blend?.b ?? null : null);
        const zIndex = videoClips.length > 1 ? baseZ + i : baseZ;
        return { clip, asset, zIndex, css, filter, muted: !isTrackAudible(track, anyTrackSoloed) };
      });
      const flashOverlayOpacity =
        transition && videoClips.length > 1 ? resolveTransitionBlend(transition.type, transition.direction, transition.easing, t).flashOverlayOpacity : 0;

      return (
        <React.Fragment key={track.id}>
          <VideoTrackSlots descriptors={descriptors} playheadMs={playheadMs} playing={playing} playbackRate={playbackRate} />
          {imageClips.map((clip, i) => renderClipLayer(track, clip, imageClips.length > 1 ? baseZ + i : baseZ, null))}
          {flashOverlayOpacity > 0.01 && (
            <div
              data-flash-overlay="true"
              className="pointer-events-none absolute inset-0 bg-white"
              style={{ zIndex: baseZ + 2, opacity: flashOverlayOpacity }}
            />
          )}
        </React.Fragment>
      );
    }

    // AUDIO
    const duckMultiplier = track.duckingEnabled
      ? computeDuckingMultiplier(playheadMs, voiceIntervalsByTrackId.get(track.id) ?? [], track.duckingAmountDb, track.duckingFadeMs)
      : 1;
    const audioClips = effectiveActive.filter((c) => c.assetId && assetById.get(c.assetId)?.kind === "AUDIO");
    const descriptors: AudioSlotDescriptor[] = audioClips.map((clip) => {
      const asset = assetById.get(clip.assetId!)!;
      const isClipA = transition && clip.id === sorted[0].id;
      const isClipB = transition && clip.id === sorted[1].id;
      const gain = transition ? resolveAudioTransitionGain(transition.easing, t) : null;
      const transitionGain = isClipA ? (gain?.gainA ?? 1) : isClipB ? (gain?.gainB ?? 1) : 1;
      return { clip, asset, muted: !isTrackAudible(track, anyTrackSoloed), gainMultiplier: transitionGain * duckMultiplier };
    });
    return <AudioTrackSlots key={track.id} descriptors={descriptors} playheadMs={playheadMs} playing={playing} playbackRate={playbackRate} />;
  }

  return (
    <BufferingReportContext.Provider value={reportBuffering}>
      {orderedVisibleTracks.map((track, index) => {
        const active = activeClipsOnTrack(track.id);
        const baseZ = computeTrackZIndex(orderedVisibleTracks.length, index);

        // VIDEO/AUDIO tracks always render their persistent slot pool,
        // even with zero currently-active clips — a slot's element and
        // its one-time Web Audio graph connection must survive gaps
        // between clips, not just live while a clip happens to be
        // active, or every gap-then-resume would reintroduce the exact
        // per-clip remount stutter this fix removes. See this file's
        // header for the full story.
        if (track.kind === "VIDEO" || track.kind === "AUDIO") {
          return renderMediaTrack(track, active, baseZ);
        }

        if (active.length === 0) return null;

        if (active.length === 1) {
          return <React.Fragment key={track.id}>{renderClipLayer(track, active[0], baseZ, null)}</React.Fragment>;
        }

        // 2+ clips active at once only happens during a transition's
        // overlap window (clipB's startMs was ripple-shifted to overlap
        // clipA's tail — see transition-engine.ts). Sort so clipA/clipB
        // match the transition row's own labeling.
        const sorted = [...active].sort((a, b) => a.startMs - b.startMs);
        const [clipA, clipB] = sorted;
        const transition = transitions.find((t) => t.trackId === track.id && t.clipAId === clipA.id && t.clipBId === clipB.id);

        if (!transition) {
          // An overlap with no transition backing it (e.g. two clips
          // manually dragged on top of each other) — fall back to the
          // simple "later clip wins" behavior this compositor had before
          // Module 9, rather than guessing at a blend.
          return <React.Fragment key={track.id}>{renderClipLayer(track, clipB, baseZ, null)}</React.Fragment>;
        }

        const t = (playheadMs - clipB.startMs) / transition.durationMs;
        const blend = resolveTransitionBlend(transition.type, transition.direction, transition.easing, t);
        return (
          <React.Fragment key={track.id}>
            {renderClipLayer(track, clipA, baseZ, blend.a)}
            {renderClipLayer(track, clipB, baseZ + 1, blend.b)}
            {blend.flashOverlayOpacity > 0.01 && (
              <div
                data-flash-overlay="true"
                className="pointer-events-none absolute inset-0 bg-white"
                style={{ zIndex: baseZ + 2, opacity: blend.flashOverlayOpacity }}
              />
            )}
          </React.Fragment>
        );
      })}
    </BufferingReportContext.Provider>
  );
}
