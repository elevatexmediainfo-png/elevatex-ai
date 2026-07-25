"use client";

import * as React from "react";
import { Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useEditorStoreApi } from "./store";
import { createUpdateContentCommand, createUpdateTrackCommand, type ClipCommandDeps, type TrackCommandDeps } from "./commands";
import type { UpdateTrackPatch } from "./queries";
import { DEFAULT_AUDIO_PROPERTIES } from "@/lib/video-editor/audio";
import type { ClipContent, ClipView, EditorAudioSubtype, TrackView } from "../types";

// Module 8 — Audio properties editor for AUDIO-kind clips. Mirrors Module
// 7's TextGroup exactly: one whole-object createUpdateContentCommand per
// commit, controlled inputs throughout (the house rule in PROJECT_STATUS.md,
// added specifically after Module 7's uncontrolled-input bug) — every field
// here reflects live `clip.content` on every render, never a defaultValue
// snapshot frozen at mount.
export function AudioGroup({
  clip,
  audioSubtype,
  commandDeps,
  track,
  allTracks,
  trackCommandDeps,
}: {
  clip: ClipView;
  audioSubtype: EditorAudioSubtype | null;
  commandDeps: ClipCommandDeps;
  // Audio Ducking (2026-07-15) — a TRACK-level feature (the toggle/amount/
  // fade/voice-selection all describe the whole MUSIC/SFX track, not this
  // one clip), so it needs the track itself + the full track list (to
  // list VOICE-tagged tracks to duck under) + a separate track-scoped
  // Command deps object, alongside this component's existing clip-scoped
  // props.
  track: TrackView;
  allTracks: TrackView[];
  trackCommandDeps: TrackCommandDeps;
}) {
  const storeApi = useEditorStoreApi();
  const content = clip.content ?? {};

  // Volume alone is `{value, keyframes}` (Module 4/6's shape) — future-
  // proofed for keyframing per the brief ("should be keyframeable later"),
  // but this module only edits `.value` directly (keyframes stays null),
  // exactly how Module 4 shipped ClipTransform's fields before Module 6
  // activated keyframing on them. See lib/video-editor/audio.ts's header
  // comment for the full reasoning.
  const volume = content.volume ?? DEFAULT_AUDIO_PROPERTIES.volume;
  const pan = content.pan ?? DEFAULT_AUDIO_PROPERTIES.pan;
  const fadeInMs = content.fadeInMs ?? DEFAULT_AUDIO_PROPERTIES.fadeInMs;
  const fadeOutMs = content.fadeOutMs ?? DEFAULT_AUDIO_PROPERTIES.fadeOutMs;
  const pitchSemitones = content.pitchSemitones ?? DEFAULT_AUDIO_PROPERTIES.pitchSemitones;
  const speed = content.speed ?? DEFAULT_AUDIO_PROPERTIES.speed;

  // Real bug found live (Module 8 Playwright verification, the exact race
  // Module 7's PROJECT_STATUS.md entry flagged as not-fully-closed):
  // `commit()` spreading `{...clip.content, ...patch}` off PROPS is stale
  // for a SECOND commit fired before React re-renders this component with
  // the FIRST commit's confirmed result — awaiting the mutation fully
  // (invalidate + refetch) still isn't enough, because there's a further,
  // separate gap between "the query cache updated" and "this specific
  // component actually re-rendered with the new prop." A ref updated
  // SYNCHRONOUSLY at commit time (before the async round trip) closes
  // that gap: the next commit, however soon it fires, always merges
  // against the latest locally-known state instead of a stale snapshot.
  // Re-synced from fresh props on every render (also handles switching to
  // a different clip, and undo/redo replacing content from outside this
  // component).
  const contentRef = React.useRef<ClipContent>(content);
  // Keyed on `clip.content` itself (not the `content` fallback, which is a
  // fresh `{}` literal every render when null) — only re-syncs when the
  // PROP actually changes reference (a real refetch, or a different clip
  // selected), never on an unrelated re-render, which is what would
  // otherwise clobber an in-flight optimistic update with a stale prop.
  React.useEffect(() => {
    contentRef.current = clip.content ?? {};
  }, [clip.content]);

  function commit(patch: Partial<ClipContent>) {
    const previous = contentRef.current;
    const next: ClipContent = { ...previous, ...patch };
    contentRef.current = next;
    void storeApi
      .getState()
      .runCommand(createUpdateContentCommand(commandDeps, clip.id, previous, next))
      .catch(() => {
        contentRef.current = previous;
      });
  }

  // Audio Ducking — same "ref synced from the live prop, commit merges
  // against the ref rather than a stale closure" shape as `commit` above,
  // just over the TRACK's own ducking fields instead of clip content.
  // createUpdateTrackCommand already exists (generic before/after
  // UpdateTrackPatch) — reused as-is, zero new command code, and this
  // gives the toggle/amount/fade/voice-selection real Ctrl+Z support.
  const trackDuckingRef = React.useRef<UpdateTrackPatch>({
    duckingEnabled: track.duckingEnabled,
    duckingAmountDb: track.duckingAmountDb,
    duckingFadeMs: track.duckingFadeMs,
    duckingVoiceTrackIds: track.duckingVoiceTrackIds,
  });
  React.useEffect(() => {
    trackDuckingRef.current = {
      duckingEnabled: track.duckingEnabled,
      duckingAmountDb: track.duckingAmountDb,
      duckingFadeMs: track.duckingFadeMs,
      duckingVoiceTrackIds: track.duckingVoiceTrackIds,
    };
  }, [track.duckingEnabled, track.duckingAmountDb, track.duckingFadeMs, track.duckingVoiceTrackIds]);

  function commitDucking(patch: Partial<UpdateTrackPatch>) {
    const previous = trackDuckingRef.current;
    const next: UpdateTrackPatch = { ...previous, ...patch };
    trackDuckingRef.current = next;
    void storeApi
      .getState()
      .runCommand(createUpdateTrackCommand(trackCommandDeps, track.id, previous, next))
      .catch(() => {
        trackDuckingRef.current = previous;
      });
  }

  const voiceTracks = allTracks.filter((t) => t.audioSubtype === "VOICE" && t.id !== track.id);

  return (
    <section className="space-y-3">
      <h3 className="border-b border-editor-line pb-1 text-label-sm text-neutral-300">Audio</h3>

      <AudioSlider
        label="Volume"
        value={volume.value * 100}
        min={0}
        max={200}
        unit="%"
        onCommit={(v) => commit({ volume: { value: v / 100, keyframes: volume.keyframes } })}
      />
      <AudioSlider label="Balance" value={pan * 100} min={-100} max={100} unit="" formatValue={formatPan} onCommit={(v) => commit({ pan: v / 100 })} />
      <AudioSlider label="Pitch" value={pitchSemitones} min={-12} max={12} step={1} unit=" st" onCommit={(v) => commit({ pitchSemitones: v })} />
      <AudioSlider label="Speed" value={speed * 100} min={25} max={400} unit="%" onCommit={(v) => commit({ speed: v / 100 })} />

      <div className="grid grid-cols-2 gap-2 text-caption">
        <span className="col-span-2 text-neutral-400">Fade (drag the clip&apos;s handles on the Timeline)</span>
        <ReadOnlyField label="Fade in" value={`${fadeInMs}ms`} />
        <ReadOnlyField label="Fade out" value={`${fadeOutMs}ms`} />
      </div>

      {/* Audio Ducking (2026-07-15) — a TRACK setting, not a clip one, but
          lives here (not a separate track-properties panel, which doesn't
          exist in this app) since this is the only UI surface reachable
          while a MUSIC/SFX clip is selected. Per the brief: opt-in,
          MUSIC/SFX subtype tracks only, off by default. */}
      {(audioSubtype === "MUSIC" || audioSubtype === "SFX") && (
        <div className="space-y-2 border-t border-editor-line pt-2">
          <label className="flex items-center gap-2 text-caption text-neutral-300">
            <input
              type="checkbox"
              checked={track.duckingEnabled}
              onChange={(e) => commitDucking({ duckingEnabled: e.target.checked })}
            />
            Duck under voice
          </label>
          {track.duckingEnabled && (
            <>
              <AudioSlider
                label="Ducking amount"
                value={track.duckingAmountDb}
                min={-60}
                max={0}
                step={1}
                unit=" dB"
                onCommit={(v) => commitDucking({ duckingAmountDb: v })}
              />
              <AudioSlider
                label="Fade duration"
                value={track.duckingFadeMs}
                min={0}
                max={2000}
                step={10}
                unit=" ms"
                onCommit={(v) => commitDucking({ duckingFadeMs: v })}
              />
              <div className="space-y-1 text-caption">
                <span className="text-neutral-400">Duck under</span>
                {voiceTracks.length === 0 ? (
                  <p className="text-neutral-500">No Voice-tagged tracks in this project yet.</p>
                ) : (
                  <div className="space-y-1">
                    {/* Empty duckingVoiceTrackIds = "auto: every VOICE track"
                        (see the Prisma schema's own doc comment) — every
                        checkbox reads as checked in that state, and the
                        FIRST manual uncheck switches the whole field from
                        auto into an explicit list containing every OTHER
                        currently-checked voice track. */}
                    {voiceTracks.map((voiceTrack, i) => {
                      const isAuto = track.duckingVoiceTrackIds.length === 0;
                      const checked = isAuto || track.duckingVoiceTrackIds.includes(voiceTrack.id);
                      return (
                        <label key={voiceTrack.id} className="flex items-center gap-2 text-neutral-300">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const currentlyExplicit = isAuto ? voiceTracks.map((t) => t.id) : track.duckingVoiceTrackIds;
                              const next = e.target.checked
                                ? [...currentlyExplicit, voiceTrack.id]
                                : currentlyExplicit.filter((id) => id !== voiceTrack.id);
                              commitDucking({ duckingVoiceTrackIds: next });
                            }}
                          />
                          Voice {i + 1}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Part D — Phase 12 AI hooks, no real logic yet. Shown for VOICE/SFX
          (and untagged AUDIO) clips; hidden for MUSIC, where neither
          operation is meaningful. */}
      {audioSubtype !== "MUSIC" && (
        <div className="space-y-1.5 border-t border-editor-line pt-2">
          <Button type="button" variant="ghost" size="sm" disabled className="w-full cursor-not-allowed justify-start text-neutral-600" title="Coming soon">
            <Wand2 className="size-3.5" />
            Noise Removal
            <span className="ml-auto text-nano text-neutral-700">Soon</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled className="w-full cursor-not-allowed justify-start text-neutral-600" title="Coming soon">
            <Sparkles className="size-3.5" />
            Voice Enhance
            <span className="ml-auto text-nano text-neutral-700">Soon</span>
          </Button>
        </div>
      )}
    </section>
  );
}

function formatPan(v: number): string {
  const rounded = Math.round(v);
  if (rounded === 0) return "C";
  return rounded < 0 ? `L${Math.abs(rounded)}` : `R${rounded}`;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-neutral-500">{label}</span>
      <div className="rounded border border-editor-line bg-editor-surface-1 px-1.5 py-1 text-neutral-300">{value}</div>
    </div>
  );
}

// Fully controlled (the house rule): `value` prop is authoritative except
// during an active drag, where local `liveValue` state takes over — same
// pattern right-properties-panel.tsx's SliderField already established for
// Transform/Crop/Blend, reused here rather than re-invented.
function AudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  formatValue,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  formatValue?: (v: number) => string;
  onCommit: (v: number) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [liveValue, setLiveValue] = React.useState(value);

  // Real bug found live (2026-07-15) — releasing a slider drag immediately
  // fell back from `liveValue` to the `value` prop, which is still the
  // STALE pre-commit value until the mutation's round trip + query
  // refetch land: confirmed live, dragging Volume to 186% displayed "100"
  // right after mouseup, correcting to 186 only ~1-1.5s later — reads as
  // "my change didn't save." Holds the just-committed value until the
  // prop actually catches up to it, instead of falling back to `value`
  // the instant the drag ends.
  const [pendingCommit, setPendingCommit] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (pendingCommit !== null && Math.abs(value - pendingCommit) < 0.001) setPendingCommit(null);
  }, [value, pendingCommit]);
  const displayValue = dragging ? liveValue : (pendingCommit ?? value);

  // Real bug found live (2026-07-15), same root cause as
  // right-properties-panel.tsx's SliderField — this number input used to
  // be bound straight to `displayValue` with no local buffer: typing
  // "175" fired onCommit on every keystroke, and each async commit's
  // eventual prop update snapped the controlled `value` back before the
  // next digit landed (confirmed: typing "175" into Volume displayed
  // "100" throughout and committed 200% to the server). Same controlled-
  // with-resync-when-unfocused pattern as text-properties-group.tsx's
  // NumberField.
  const [inputFocused, setInputFocused] = React.useState(false);
  const [localInput, setLocalInput] = React.useState(String(Math.round(value * 100) / 100));
  React.useEffect(() => {
    if (!inputFocused) setLocalInput(String(Math.round(displayValue * 100) / 100));
  }, [displayValue, inputFocused]);

  return (
    <div className="space-y-1 text-caption">
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            aria-label={label}
            className="w-16 rounded border border-editor-line bg-editor-surface-1 px-1.5 py-0.5 text-right text-neutral-100"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={(e) => {
              setInputFocused(false);
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onCommit(Math.min(max, Math.max(min, v)));
            }}
          />
          <span className="w-6 text-neutral-500">{formatValue ? formatValue(displayValue) : unit}</span>
        </div>
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onPointerDown={() => setDragging(true)}
        onChange={(e) => setLiveValue(Number(e.target.value))}
        onPointerUp={(e) => {
          setDragging(false);
          const v = Number((e.target as HTMLInputElement).value);
          setPendingCommit(v);
          onCommit(v);
        }}
        className="w-full accent-editor-accent"
      />
    </div>
  );
}
