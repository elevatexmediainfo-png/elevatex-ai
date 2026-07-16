"use client";

import * as React from "react";
import { ChevronDown, FlipHorizontal, FlipVertical, Link2, MousePointerClick, Sparkles, Unlink2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmptyState } from "./creative-studio-sidebar/shared/empty-state";
import { MotionPanelFade } from "./motion-primitives";
import { useEditorStore, useEditorStoreApi } from "./store";
import { useUpdateClipMutation, useUpdateTrackMutation } from "./queries";
import { createCompositeCommand, createUpdateTransformCommand, type ClipCommandDeps, type TrackCommandDeps } from "./commands";
import { StopwatchToggle } from "./keyframe-controls";
import { TextGroup } from "./text-properties-group";
import { AudioGroup } from "./audio-properties-group";
import {
  allShareValue,
  ANIMATION_PRESETS,
  applyAnimationPreset,
  DEFAULT_CLIP_TRANSFORM,
  findKeyframeAt,
  keyframeableToKeyframed,
  keyframeableToStatic,
  resolveTransformValue,
  updateKeyframeValue,
  BLEND_MODES,
  type BlendMode,
  type ClipTransform,
  type CropRect,
  type Keyframeable,
} from "@/lib/video-editor/transform";
import { clipEndMs, formatTimecode, type ClipView, type TrackView } from "../types";

// Right Properties Panel (Milestone 24; Transform/Crop/Blend Module 4;
// keyframes Module 6) — every field here edits ClipTransform
// (lib/video-editor/transform.ts). Two rendering paths:
//  - Multi-select (2+ clips): Module 4's original flat editor, unchanged —
//    keyframing a multi-clip selection is out of scope (a stated cut, see
//    PROJECT_STATUS.md), so these fields always edit `.value` directly.
//  - Single clip: keyframe-aware. Each animatable property (scale,
//    position, rotation, opacity, crop) gets a stopwatch toggle; once
//    keyframed, the field shows the value interpolated at the current
//    playhead and is read-only UNLESS the playhead sits exactly on a
//    keyframe, in which case editing moves that keyframe's value (per the
//    brief). `playheadMs` is a reactive subscription here specifically so
//    this panel updates live during scrubbing/playback — the Timeline
//    itself does NOT subscribe to playheadMs reactively (see its
//    "transient updates" comment), so this is the one exception the
//    Module 6 brief explicitly carves out.
export function RightPropertiesPanel({
  projectId,
  clips,
  tracks,
}: {
  projectId: string;
  clips: ClipView[];
  tracks: TrackView[];
}) {
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const liveClipOverride = useEditorStore((s) => s.liveClipOverride);
  const setLiveClipOverride = useEditorStore((s) => s.setLiveClipOverride);
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const storeApi = useEditorStoreApi();
  const selectedClips = clips.filter((c) => selectedClipIds.has(c.id));

  const updateClipMutation = useUpdateClipMutation(projectId);
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

  const updateTrackMutation = useUpdateTrackMutation(projectId);
  const trackCommandDeps: TrackCommandDeps = React.useMemo(
    () => ({ updateTrack: (input) => updateTrackMutation.mutateAsync(input) }),
    [updateTrackMutation]
  );

  const transforms = selectedClips.map((c) => c.transform ?? DEFAULT_CLIP_TRANSFORM);
  const primaryClip = selectedClips[0] ?? null;

  function currentTransformOf(clip: ClipView): ClipTransform {
    if (liveClipOverride?.clipId === clip.id) return liveClipOverride.transform;
    return clip.transform ?? DEFAULT_CLIP_TRANSFORM;
  }

  // Live preview during a drag — writes only the first selected clip's
  // override (see file header for why).
  function liveUpdate(updater: (t: ClipTransform) => ClipTransform) {
    if (!primaryClip) return;
    setLiveClipOverride({ clipId: primaryClip.id, transform: updater(currentTransformOf(primaryClip)) });
  }

  // Commit — one command per selected clip, each keeping its own other
  // fields and only changing what `updater` touches; wrapped as a single
  // composite so a multi-select edit is one Ctrl+Z, not one per clip.
  function commit(updater: (t: ClipTransform) => ClipTransform) {
    const perClipCommands = selectedClips.map((clip) => {
      const previous = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
      const next = updater(previous);
      return createUpdateTransformCommand(commandDeps, clip.id, previous, next);
    });
    if (perClipCommands.length === 0) return;
    const command =
      perClipCommands.length === 1 ? perClipCommands[0] : createCompositeCommand("Update Transform", perClipCommands);
    void storeApi
      .getState()
      .runCommand(command)
      .catch(() => {
        // Failure is already surfaced via the store's saveStatus — nothing
        // else to do here besides not leaving an unhandled rejection.
      })
      .finally(() => {
        if (primaryClip && storeApi.getState().liveClipOverride?.clipId === primaryClip.id) {
          setLiveClipOverride(null);
        }
      });
  }

  // Single-clip commit for keyframe edits — always exactly one command,
  // no composite wrapping needed (there's only ever one clip).
  function commitSingle(next: ClipTransform) {
    if (!primaryClip) return;
    const previous = primaryClip.transform ?? DEFAULT_CLIP_TRANSFORM;
    void storeApi
      .getState()
      .runCommand(createUpdateTransformCommand(commandDeps, primaryClip.id, previous, next))
      .catch(() => {});
  }

  const isSingleSelect = selectedClips.length === 1 && primaryClip !== null;
  const atMs = primaryClip ? playheadMs - primaryClip.startMs : 0;
  const primaryTrack = primaryClip ? tracks.find((t) => t.id === primaryClip.trackId) : undefined;
  const primaryTrackKind = primaryTrack?.kind;
  const isTextClip = primaryTrackKind === "TEXT" || primaryTrackKind === "SUBTITLE";
  // Module 8 — a VIDEO clip's own embedded audio isn't independently
  // editable this module (track mute/solo cover it); AudioGroup is
  // AUDIO-track clips only.
  const isAudioClip = primaryTrackKind === "AUDIO";

  // Section 7/8 (2026-07-14, premium-editor.jsx rebuild) — this panel was
  // already built to the reference's own spec in an earlier pass (real
  // tabs — Transform/Animation/Text/Crop — the shared EmptyState with a
  // real "Open media library" action, no fake AI/Color tab), so this pass
  // is a light consistency touch-up, not a rebuild. Header gained a
  // bottom border matching PanelHeader's own (creative-studio-sidebar/
  // shared/panel-header.tsx) header/content separation, the one visible
  // gap against the rest of the now-rebuilt editor's panels.
  //
  // Re-confirmed, not re-decided (2026-07-14, full-spec audit) — a second
  // spec pass re-stated ~647px for this panel "when populated," but its
  // own wording explicitly allows staying narrower ("don't force width to
  // match if it fights existing layout"); kept at 256px. Same spec
  // explicitly rules out the reference's "Project/Details" tabs and
  // "Smart Suggestions/Analyze/Global Edits" panel as a fake AI panel
  // already out of scope — already true here, nothing to remove.
  //
  // w-64 (fixed) -> a CSS variable (2026-07-15, resizable panels) — same
  // pattern as the Left Panel (creative-studio-sidebar/index.tsx), the
  // `256px` fallback matching PANEL_SIZE_LIMITS.rightPanelWidth.default.
  return (
    <aside
      className="flex shrink-0 flex-col overflow-y-auto border-l border-editor-line bg-editor-panel"
      style={{ width: "var(--editor-right-panel-width, 256px)" }}
    >
      <h2 className="border-b border-editor-line p-4 text-editor-panel-title text-neutral-100">Properties</h2>
      <div className="flex flex-1 flex-col gap-4 p-4">
      {selectedClips.length === 0 ? (
        // Fix (2026-07-13) — the 2026-07-12 restyle added the icon/title/
        // description via the sidebar's shared EmptyState but no action.
        // Now offers one genuinely real action alongside the "select a
        // clip" guidance: switches the Creative Studio Sidebar to Uploads
        // (real, existing functionality — see the store's
        // activeSidebarSectionId, lifted out of the sidebar's own local
        // state specifically so this cross-panel action could exist).
        // Deliberately no "Generate with AI" option — no such feature
        // exists yet (Phase 12), that would be exactly the fake affordance
        // this pass's own brief forbids.
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={MousePointerClick}
            title="No clip selected"
            description="Select a clip on the Timeline to see its properties, or add media to your project to get started."
            actionLabel="Open media library"
            onAction={() => storeApi.getState().setActiveSidebarSectionId("uploads")}
          />
        </div>
      ) : (
        <>
          <dl className="space-y-2 text-caption">
            <Row label="Start" value={formatTimecode(selectedClips[0].startMs)} />
            <Row label="Duration" value={formatTimecode(selectedClips[0].durationMs)} />
            <Row label="End" value={formatTimecode(clipEndMs(selectedClips[0]))} />
            <Row label="Trim in" value={formatTimecode(selectedClips[0].trimStartMs)} />
            {selectedClips.length > 1 && <Row label="Selected" value={`${selectedClips.length} clips`} />}
          </dl>

          {isSingleSelect && primaryClip ? (
            <>
              {isAudioClip ? (
                // An AUDIO clip produces no video frame — Transform/Crop/
                // Blend (position/scale/rotation/crop/opacity/flip) and the
                // enter/exit animation preset menu are all visually
                // meaningless for it, so this replaces that whole group
                // rather than adding alongside it (unlike TEXT, which
                // composes ClipTransform additively over its own content
                // placement and keeps every one of those groups).
                primaryTrack && (
                  <AudioGroup
                    clip={primaryClip}
                    audioSubtype={primaryTrack.audioSubtype}
                    commandDeps={commandDeps}
                    track={primaryTrack}
                    allTracks={tracks}
                    trackCommandDeps={trackCommandDeps}
                  />
                )
              ) : (
                <SingleClipTabs
                  clipId={primaryClip.id}
                  isTextClip={isTextClip}
                  transform={currentTransformOf(primaryClip)}
                  atMs={atMs}
                  liveUpdate={liveUpdate}
                  commit={commitSingle}
                  onApplyPreset={(presetId) => {
                    const previous = primaryClip.transform ?? DEFAULT_CLIP_TRANSFORM;
                    commitSingle(applyAnimationPreset(previous, presetId, primaryClip.durationMs));
                  }}
                  textGroup={
                    isTextClip ? (
                      <TextGroup
                        projectId={projectId}
                        clip={primaryClip}
                        isSubtitle={primaryTrackKind === "SUBTITLE"}
                        commandDeps={commandDeps}
                      />
                    ) : null
                  }
                />
              )}
            </>
          ) : (
            <>
              <p className="text-caption text-neutral-500">Select a single clip to add keyframes.</p>
              <TransformGroup transforms={transforms} liveUpdate={liveUpdate} commit={commit} />
              <CropGroup transforms={transforms} liveUpdate={liveUpdate} commit={commit} />
              <BlendGroup transforms={transforms} liveUpdate={liveUpdate} commit={commit} />
            </>
          )}
        </>
      )}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{value}</dd>
    </div>
  );
}

// text-[13px] font-bold (2026-07-14, full-spec audit) — was text-label-sm
// (12px/600-weight), close but not quite the spec's own explicit "~13px
// bold" density guidance for section labels; a one-line size/weight bump,
// not a restructure.
function GroupHeader({ label }: { label: string }) {
  return <h3 className="border-b border-editor-line pb-1 text-[13px] font-bold text-neutral-300">{label}</h3>;
}

function AnimationPresetMenu({ onApply }: { onApply: (presetId: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-neutral-300 hover:text-white">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Apply Animation Preset
          </span>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {ANIMATION_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset.id} onClick={() => onApply(preset.id)} title={preset.description}>
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Fix (2026-07-13) — right panel reorganized into real tabs (Transform /
// Animation / Text / Crop; Audio clips never reach this component — see
// the AudioGroup branch above — and there's no "Blend" tab in the brief's
// list, so opacity/flip live inside the Transform tab as a sub-section
// rather than being dropped). Only the single-clip, keyframe-aware view is
// tabbed; the multi-select flat editor further below stays exactly as
// Module 4 built it (a stated, unchanged scope boundary — keyframing a
// multi-selection was never in scope, and a heterogeneous multi-select can
// mix clip kinds, which doesn't map cleanly onto one clip's own tab set).
type SingleClipTabId = "transform" | "animation" | "crop" | "text";

function SingleClipTabs({
  clipId,
  isTextClip,
  transform,
  atMs,
  liveUpdate,
  commit,
  onApplyPreset,
  textGroup,
}: {
  clipId: string;
  isTextClip: boolean;
  transform: ClipTransform;
  atMs: number;
  liveUpdate: SingleUpdater;
  commit: SingleCommit;
  onApplyPreset: (presetId: string) => void;
  textGroup: React.ReactNode;
}) {
  const tabs: { id: SingleClipTabId; label: string }[] = isTextClip
    ? [
        { id: "transform", label: "Transform" },
        { id: "animation", label: "Animation" },
        { id: "text", label: "Text" },
      ]
    : [
        { id: "transform", label: "Transform" },
        { id: "animation", label: "Animation" },
        { id: "crop", label: "Crop" },
      ];
  const [activeTab, setActiveTab] = React.useState<SingleClipTabId>("transform");

  // A different clip (or a clip-kind switch that changes which tabs even
  // exist, e.g. TEXT<->VIDEO) always lands back on Transform — otherwise a
  // stale tab id from the previous selection (e.g. "crop" while now
  // viewing a TEXT clip, which has no Crop tab) could stick with no
  // matching trigger.
  React.useEffect(() => {
    setActiveTab("transform");
  }, [clipId, isTextClip]);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SingleClipTabId)} className="gap-3">
      <TabsList
        className={cn(
          "h-auto w-full gap-0.5 rounded-editor-button bg-editor-surface-1 p-1",
          '[&_[data-slot="tabs-trigger"]]:rounded-[10px] [&_[data-slot="tabs-trigger"]]:py-1 [&_[data-slot="tabs-trigger"]]:text-caption [&_[data-slot="tabs-trigger"]]:text-neutral-400',
          '[&_[data-slot="tabs-trigger"][data-state="active"]]:bg-editor-surface-2 [&_[data-slot="tabs-trigger"][data-state="active"]]:text-editor-accent [&_[data-slot="tabs-trigger"][data-state="active"]]:shadow-none'
        )}
      >
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="transform" className="space-y-4">
        <MotionPanelFade panelKey={`transform-${clipId}`} className="space-y-4">
          <SingleClipTransformGroup transform={transform} atMs={atMs} liveUpdate={liveUpdate} commit={commit} />
          <SingleClipBlendGroup transform={transform} atMs={atMs} liveUpdate={liveUpdate} commit={commit} />
        </MotionPanelFade>
      </TabsContent>
      <TabsContent value="animation">
        <MotionPanelFade panelKey={`animation-${clipId}`}>
          <AnimationPresetMenu onApply={onApplyPreset} />
        </MotionPanelFade>
      </TabsContent>
      {isTextClip ? (
        <TabsContent value="text">
          <MotionPanelFade panelKey={`text-${clipId}`}>{textGroup}</MotionPanelFade>
        </TabsContent>
      ) : (
        <TabsContent value="crop">
          <MotionPanelFade panelKey={`crop-${clipId}`}>
            <SingleClipCropGroup transform={transform} atMs={atMs} liveUpdate={liveUpdate} commit={commit} />
          </MotionPanelFade>
        </TabsContent>
      )}
    </Tabs>
  );
}

// ---- Multi-select flat editor (Module 4, unchanged) ----

type Updater = (updater: (t: ClipTransform) => ClipTransform) => void;

function TransformGroup({
  transforms,
  liveUpdate,
  commit,
}: {
  transforms: ClipTransform[];
  liveUpdate: Updater;
  commit: Updater;
}) {
  const uniform = transforms.every((t) => t.scaleY === null);
  const scaleXValues = transforms.map((t) => t.scale.value);
  const scaleYValues = transforms.map((t) => t.scaleY?.value ?? t.scale.value);
  const posXValues = transforms.map((t) => t.position.value.x);
  const posYValues = transforms.map((t) => t.position.value.y);
  const rotationValues = transforms.map((t) => t.rotation.value);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <GroupHeader label="Transform" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={uniform ? "Unlink X/Y scale" : "Link X/Y scale"}
          onClick={() =>
            commit((t) =>
              uniform
                ? { ...t, scaleY: { value: t.scale.value, keyframes: null } }
                : { ...t, scaleY: null }
            )
          }
        >
          {uniform ? <Link2 className="size-3.5" /> : <Unlink2 className="size-3.5" />}
        </Button>
      </div>

      <SliderField
        label={uniform ? "Scale" : "Scale X"}
        value={scaleXValues[0] ?? 100}
        mixed={!allShareValue(scaleXValues)}
        min={1}
        max={500}
        unit="%"
        onLiveChange={(v) =>
          liveUpdate((t) => ({
            ...t,
            scale: { value: v, keyframes: null },
            scaleY: t.scaleY ? { value: v, keyframes: null } : null,
          }))
        }
        onCommit={(v) =>
          commit((t) => ({
            ...t,
            scale: { value: v, keyframes: null },
            scaleY: t.scaleY ? { value: v, keyframes: null } : null,
          }))
        }
      />
      {!uniform && (
        <SliderField
          label="Scale Y"
          value={scaleYValues[0] ?? 100}
          mixed={!allShareValue(scaleYValues)}
          min={1}
          max={500}
          unit="%"
          onLiveChange={(v) => liveUpdate((t) => ({ ...t, scaleY: { value: v, keyframes: null } }))}
          onCommit={(v) => commit((t) => ({ ...t, scaleY: { value: v, keyframes: null } }))}
        />
      )}

      <SliderField
        label="Position X"
        value={posXValues[0] ?? 0}
        mixed={!allShareValue(posXValues)}
        min={-150}
        max={150}
        unit="%"
        onLiveChange={(v) =>
          liveUpdate((t) => ({ ...t, position: { value: { x: v, y: t.position.value.y }, keyframes: null } }))
        }
        onCommit={(v) =>
          commit((t) => ({ ...t, position: { value: { x: v, y: t.position.value.y }, keyframes: null } }))
        }
      />
      <SliderField
        label="Position Y"
        value={posYValues[0] ?? 0}
        mixed={!allShareValue(posYValues)}
        min={-150}
        max={150}
        unit="%"
        onLiveChange={(v) =>
          liveUpdate((t) => ({ ...t, position: { value: { x: t.position.value.x, y: v }, keyframes: null } }))
        }
        onCommit={(v) =>
          commit((t) => ({ ...t, position: { value: { x: t.position.value.x, y: v }, keyframes: null } }))
        }
      />

      <SliderField
        label="Rotation"
        value={rotationValues[0] ?? 0}
        mixed={!allShareValue(rotationValues)}
        min={-180}
        max={180}
        unit="°"
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, rotation: { value: v, keyframes: null } }))}
        onCommit={(v) => commit((t) => ({ ...t, rotation: { value: v, keyframes: null } }))}
      />
    </section>
  );
}

function CropGroup({ transforms, liveUpdate, commit }: { transforms: ClipTransform[]; liveUpdate: Updater; commit: Updater }) {
  const topValues = transforms.map((t) => t.crop.value.top);
  const rightValues = transforms.map((t) => t.crop.value.right);
  const bottomValues = transforms.map((t) => t.crop.value.bottom);
  const leftValues = transforms.map((t) => t.crop.value.left);

  function withCrop(t: ClipTransform, patch: Partial<CropRect>): ClipTransform {
    const next: CropRect = { ...t.crop.value, ...patch };
    next.top = Math.min(next.top, 100 - next.bottom);
    next.bottom = Math.min(next.bottom, 100 - next.top);
    next.left = Math.min(next.left, 100 - next.right);
    next.right = Math.min(next.right, 100 - next.left);
    return { ...t, crop: { value: next, keyframes: null } };
  }

  return (
    <section className="space-y-3">
      <GroupHeader label="Crop" />
      <SliderField
        label="Top"
        value={topValues[0] ?? 0}
        mixed={!allShareValue(topValues)}
        min={0}
        max={100}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => withCrop(t, { top: v }))}
        onCommit={(v) => commit((t) => withCrop(t, { top: v }))}
      />
      <SliderField
        label="Right"
        value={rightValues[0] ?? 0}
        mixed={!allShareValue(rightValues)}
        min={0}
        max={100}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => withCrop(t, { right: v }))}
        onCommit={(v) => commit((t) => withCrop(t, { right: v }))}
      />
      <SliderField
        label="Bottom"
        value={bottomValues[0] ?? 0}
        mixed={!allShareValue(bottomValues)}
        min={0}
        max={100}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => withCrop(t, { bottom: v }))}
        onCommit={(v) => commit((t) => withCrop(t, { bottom: v }))}
      />
      <SliderField
        label="Left"
        value={leftValues[0] ?? 0}
        mixed={!allShareValue(leftValues)}
        min={0}
        max={100}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => withCrop(t, { left: v }))}
        onCommit={(v) => commit((t) => withCrop(t, { left: v }))}
      />
    </section>
  );
}

// Shared by both the multi-select BlendGroup and the single-clip keyframed
// variant — a blend-mode change isn't keyframeable (see BLEND_MODES' own
// comment in transform.ts), so both call sites just need one plain
// controlled picker over the same 6 CSS mix-blend-mode values.
function BlendModeSelect({ value, mixed, onChange }: { value: BlendMode; mixed: boolean; onChange: (mode: BlendMode) => void }) {
  return (
    <div className="space-y-1 text-caption">
      <span className="text-neutral-400">Blend mode</span>
      <Select value={mixed ? "" : value} onValueChange={(v) => onChange(v as BlendMode)}>
        <SelectTrigger className="h-8 w-full rounded-md border-editor-line bg-editor-surface-1 text-neutral-100 data-placeholder:text-neutral-500">
          <SelectValue placeholder="Mixed" />
        </SelectTrigger>
        <SelectContent className="border-editor-line bg-editor-surface-2 text-neutral-100">
          {BLEND_MODES.map((mode) => (
            <SelectItem key={mode} value={mode} className="capitalize focus:bg-editor-surface-1 focus:text-white">
              {mode}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BlendGroup({ transforms, liveUpdate, commit }: { transforms: ClipTransform[]; liveUpdate: Updater; commit: Updater }) {
  const opacityValues = transforms.map((t) => t.opacity.value);
  const flipHValues = transforms.map((t) => t.flipH);
  const flipVValues = transforms.map((t) => t.flipV);
  const flipHOn = flipHValues.every(Boolean);
  const flipVOn = flipVValues.every(Boolean);
  const blendModeValues = transforms.map((t) => t.blendMode);

  return (
    <section className="space-y-3">
      <GroupHeader label="Blend" />
      <SliderField
        label="Opacity"
        value={opacityValues[0] ?? 100}
        mixed={!allShareValue(opacityValues)}
        min={0}
        max={100}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, opacity: { value: v, keyframes: null } }))}
        onCommit={(v) => commit((t) => ({ ...t, opacity: { value: v, keyframes: null } }))}
      />
      <BlendModeSelect
        value={blendModeValues[0] ?? "normal"}
        mixed={!allShareValue(blendModeValues)}
        onChange={(mode) => commit((t) => ({ ...t, blendMode: mode }))}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant={flipHOn ? "primary" : "ghost"}
          size="sm"
          className={flipHOn ? "flex-1" : "flex-1 border border-editor-line text-neutral-300 hover:bg-editor-surface-2 hover:text-white"}
          onClick={() => commit((t) => ({ ...t, flipH: !flipHOn }))}
        >
          <FlipHorizontal className="size-4" />
          Flip H
        </Button>
        <Button
          type="button"
          variant={flipVOn ? "primary" : "ghost"}
          size="sm"
          className={flipVOn ? "flex-1" : "flex-1 border border-editor-line text-neutral-300 hover:bg-editor-surface-2 hover:text-white"}
          onClick={() => commit((t) => ({ ...t, flipV: !flipVOn }))}
        >
          <FlipVertical className="size-4" />
          Flip V
        </Button>
      </div>
    </section>
  );
}

// ---- Single-clip keyframe-aware editor (Module 6) ----

type SingleUpdater = (updater: (t: ClipTransform) => ClipTransform) => void;
type SingleCommit = (next: ClipTransform) => void;

// Shared logic every keyframeable number field needs: is it keyframed, what
// value should show right now, and is that value editable at this instant.
function useKeyframeFieldState<T>(prop: Keyframeable<T>, atMs: number) {
  const keyframed = !!prop.keyframes && prop.keyframes.length > 0;
  const resolvedValue = resolveTransformValue(prop, atMs);
  const activeKeyframe = keyframed ? findKeyframeAt(prop, atMs) : null;
  const editable = !keyframed || activeKeyframe !== null;
  return { keyframed, resolvedValue, activeKeyframe, editable };
}

function SingleClipTransformGroup({
  transform,
  atMs,
  liveUpdate,
  commit,
}: {
  transform: ClipTransform;
  atMs: number;
  liveUpdate: SingleUpdater;
  commit: SingleCommit;
}) {
  const uniform = transform.scaleY === null;
  const scaleState = useKeyframeFieldState(transform.scale, atMs);
  const scaleYState = useKeyframeFieldState(transform.scaleY ?? DEFAULT_CLIP_TRANSFORM.scale, atMs);
  const positionState = useKeyframeFieldState(transform.position, atMs);
  const rotationState = useKeyframeFieldState(transform.rotation, atMs);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <GroupHeader label="Transform" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={uniform ? "Unlink X/Y scale" : "Link X/Y scale"}
          onClick={() =>
            commit(
              uniform
                ? { ...transform, scaleY: { value: transform.scale.value, keyframes: null } }
                : { ...transform, scaleY: null }
            )
          }
        >
          {uniform ? <Link2 className="size-3.5" /> : <Unlink2 className="size-3.5" />}
        </Button>
      </div>

      <KeyframeableNumberField
        label={uniform ? "Scale" : "Scale X"}
        min={1}
        max={500}
        unit="%"
        state={scaleState}
        atMs={atMs}
        onToggleKeyframe={() =>
          commit({
            ...transform,
            scale: scaleState.keyframed ? keyframeableToStatic(transform.scale, atMs) : keyframeableToKeyframed(transform.scale, atMs),
          })
        }
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, scale: { ...t.scale, value: v } }))}
        onCommitValue={(v) => {
          if (scaleState.keyframed && scaleState.activeKeyframe) {
            commit({ ...transform, scale: updateKeyframeValue(transform.scale, scaleState.activeKeyframe.id, v) });
          } else {
            commit({ ...transform, scale: { value: v, keyframes: null } });
          }
        }}
      />
      {!uniform && (
        <KeyframeableNumberField
          label="Scale Y"
          min={1}
          max={500}
          unit="%"
          state={scaleYState}
          atMs={atMs}
          onToggleKeyframe={() =>
            commit({
              ...transform,
              scaleY: scaleYState.keyframed
                ? keyframeableToStatic(transform.scaleY!, atMs)
                : keyframeableToKeyframed(transform.scaleY!, atMs),
            })
          }
          onLiveChange={(v) => liveUpdate((t) => ({ ...t, scaleY: t.scaleY ? { ...t.scaleY, value: v } : { value: v, keyframes: null } }))}
          onCommitValue={(v) => {
            if (scaleYState.keyframed && scaleYState.activeKeyframe) {
              commit({ ...transform, scaleY: updateKeyframeValue(transform.scaleY!, scaleYState.activeKeyframe.id, v) });
            } else {
              commit({ ...transform, scaleY: { value: v, keyframes: null } });
            }
          }}
        />
      )}

      <div className="flex items-center gap-1.5">
        <StopwatchToggle
          keyframed={positionState.keyframed}
          onToggle={() =>
            commit({
              ...transform,
              position: positionState.keyframed
                ? keyframeableToStatic(transform.position, atMs)
                : keyframeableToKeyframed(transform.position, atMs),
            })
          }
        />
        <span className="text-caption text-neutral-400">Position</span>
      </div>
      <SliderField
        label="Position X"
        value={positionState.resolvedValue.x}
        mixed={false}
        disabled={!positionState.editable}
        min={-150}
        max={150}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, position: { ...t.position, value: { ...t.position.value, x: v } } }))}
        onCommit={(v) => {
          const nextPoint = { x: v, y: positionState.resolvedValue.y };
          if (positionState.keyframed && positionState.activeKeyframe) {
            commit({ ...transform, position: updateKeyframeValue(transform.position, positionState.activeKeyframe.id, nextPoint) });
          } else {
            commit({ ...transform, position: { value: nextPoint, keyframes: null } });
          }
        }}
      />
      <SliderField
        label="Position Y"
        value={positionState.resolvedValue.y}
        mixed={false}
        disabled={!positionState.editable}
        min={-150}
        max={150}
        unit="%"
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, position: { ...t.position, value: { ...t.position.value, y: v } } }))}
        onCommit={(v) => {
          const nextPoint = { x: positionState.resolvedValue.x, y: v };
          if (positionState.keyframed && positionState.activeKeyframe) {
            commit({ ...transform, position: updateKeyframeValue(transform.position, positionState.activeKeyframe.id, nextPoint) });
          } else {
            commit({ ...transform, position: { value: nextPoint, keyframes: null } });
          }
        }}
      />

      <KeyframeableNumberField
        label="Rotation"
        min={-180}
        max={180}
        unit="°"
        state={rotationState}
        atMs={atMs}
        onToggleKeyframe={() =>
          commit({
            ...transform,
            rotation: rotationState.keyframed
              ? keyframeableToStatic(transform.rotation, atMs)
              : keyframeableToKeyframed(transform.rotation, atMs),
          })
        }
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, rotation: { ...t.rotation, value: v } }))}
        onCommitValue={(v) => {
          if (rotationState.keyframed && rotationState.activeKeyframe) {
            commit({ ...transform, rotation: updateKeyframeValue(transform.rotation, rotationState.activeKeyframe.id, v) });
          } else {
            commit({ ...transform, rotation: { value: v, keyframes: null } });
          }
        }}
      />
    </section>
  );
}

function SingleClipCropGroup({
  transform,
  atMs,
  liveUpdate,
  commit,
}: {
  transform: ClipTransform;
  atMs: number;
  liveUpdate: SingleUpdater;
  commit: SingleCommit;
}) {
  const cropState = useKeyframeFieldState(transform.crop, atMs);

  function withCropCommit(patch: Partial<CropRect>) {
    const current = cropState.resolvedValue;
    const next: CropRect = { ...current, ...patch };
    next.top = Math.min(next.top, 100 - next.bottom);
    next.bottom = Math.min(next.bottom, 100 - next.top);
    next.left = Math.min(next.left, 100 - next.right);
    next.right = Math.min(next.right, 100 - next.left);
    if (cropState.keyframed && cropState.activeKeyframe) {
      commit({ ...transform, crop: updateKeyframeValue(transform.crop, cropState.activeKeyframe.id, next) });
    } else {
      commit({ ...transform, crop: { value: next, keyframes: null } });
    }
  }
  function withCropLive(patch: Partial<CropRect>) {
    liveUpdate((t) => {
      const next: CropRect = { ...t.crop.value, ...patch };
      return { ...t, crop: { ...t.crop, value: next } };
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        <StopwatchToggle
          keyframed={cropState.keyframed}
          onToggle={() =>
            commit({
              ...transform,
              crop: cropState.keyframed ? keyframeableToStatic(transform.crop, atMs) : keyframeableToKeyframed(transform.crop, atMs),
            })
          }
        />
        <GroupHeader label="Crop" />
      </div>
      <SliderField label="Top" value={cropState.resolvedValue.top} mixed={false} disabled={!cropState.editable} min={0} max={100} unit="%" onLiveChange={(v) => withCropLive({ top: v })} onCommit={(v) => withCropCommit({ top: v })} />
      <SliderField label="Right" value={cropState.resolvedValue.right} mixed={false} disabled={!cropState.editable} min={0} max={100} unit="%" onLiveChange={(v) => withCropLive({ right: v })} onCommit={(v) => withCropCommit({ right: v })} />
      <SliderField label="Bottom" value={cropState.resolvedValue.bottom} mixed={false} disabled={!cropState.editable} min={0} max={100} unit="%" onLiveChange={(v) => withCropLive({ bottom: v })} onCommit={(v) => withCropCommit({ bottom: v })} />
      <SliderField label="Left" value={cropState.resolvedValue.left} mixed={false} disabled={!cropState.editable} min={0} max={100} unit="%" onLiveChange={(v) => withCropLive({ left: v })} onCommit={(v) => withCropCommit({ left: v })} />
    </section>
  );
}

function SingleClipBlendGroup({
  transform,
  atMs,
  liveUpdate,
  commit,
}: {
  transform: ClipTransform;
  atMs: number;
  liveUpdate: SingleUpdater;
  commit: SingleCommit;
}) {
  const opacityState = useKeyframeFieldState(transform.opacity, atMs);

  return (
    <section className="space-y-3">
      <GroupHeader label="Blend" />
      <KeyframeableNumberField
        label="Opacity"
        min={0}
        max={100}
        unit="%"
        state={opacityState}
        atMs={atMs}
        onToggleKeyframe={() =>
          commit({
            ...transform,
            opacity: opacityState.keyframed
              ? keyframeableToStatic(transform.opacity, atMs)
              : keyframeableToKeyframed(transform.opacity, atMs),
          })
        }
        onLiveChange={(v) => liveUpdate((t) => ({ ...t, opacity: { ...t.opacity, value: v } }))}
        onCommitValue={(v) => {
          if (opacityState.keyframed && opacityState.activeKeyframe) {
            commit({ ...transform, opacity: updateKeyframeValue(transform.opacity, opacityState.activeKeyframe.id, v) });
          } else {
            commit({ ...transform, opacity: { value: v, keyframes: null } });
          }
        }}
      />
      <BlendModeSelect
        value={transform.blendMode}
        mixed={false}
        onChange={(mode) => commit({ ...transform, blendMode: mode })}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant={transform.flipH ? "primary" : "ghost"}
          size="sm"
          className={transform.flipH ? "flex-1" : "flex-1 border border-editor-line text-neutral-300 hover:bg-editor-surface-2 hover:text-white"}
          onClick={() => commit({ ...transform, flipH: !transform.flipH })}
        >
          <FlipHorizontal className="size-4" />
          Flip H
        </Button>
        <Button
          type="button"
          variant={transform.flipV ? "primary" : "ghost"}
          size="sm"
          className={transform.flipV ? "flex-1" : "flex-1 border border-editor-line text-neutral-300 hover:bg-editor-surface-2 hover:text-white"}
          onClick={() => commit({ ...transform, flipV: !transform.flipV })}
        >
          <FlipVertical className="size-4" />
          Flip V
        </Button>
      </div>
    </section>
  );
}

function KeyframeableNumberField({
  label,
  min,
  max,
  unit,
  state,
  onToggleKeyframe,
  onLiveChange,
  onCommitValue,
}: {
  label: string;
  min: number;
  max: number;
  unit: string;
  state: { keyframed: boolean; resolvedValue: number; editable: boolean };
  atMs: number;
  onToggleKeyframe: () => void;
  onLiveChange: (v: number) => void;
  onCommitValue: (v: number) => void;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <StopwatchToggle keyframed={state.keyframed} onToggle={onToggleKeyframe} />
      <div className="flex-1">
        <SliderField
          label={label}
          value={state.resolvedValue}
          mixed={false}
          disabled={!state.editable}
          min={min}
          max={max}
          unit={unit}
          onLiveChange={onLiveChange}
          onCommit={onCommitValue}
        />
      </div>
    </div>
  );
}

// Native <input type="range"> drag already batches at the browser's own
// input-event rate; we additionally coalesce onLiveChange to one rAF tick
// so a fast drag doesn't fire a store write per native input event either.
// `disabled` (Module 6) — true when a keyframed property's value at the
// current playhead isn't sitting exactly on a keyframe: shows the
// interpolated value, read-only.
function SliderField({
  label,
  value,
  mixed,
  disabled = false,
  min,
  max,
  step = 1,
  unit = "",
  onLiveChange,
  onCommit,
}: {
  label: string;
  value: number;
  mixed: boolean;
  disabled?: boolean;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onLiveChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [liveValue, setLiveValue] = React.useState(value);
  const rafRef = React.useRef<number | null>(null);

  // Real bug found live (2026-07-15) — releasing a slider drag immediately
  // fell back from `liveValue` to the `value` prop, which is still the
  // STALE pre-commit value until the mutation's round trip + query
  // refetch land: confirmed live (same component family as AudioSlider,
  // which showed the identical glitch — dragging a value to 186% and
  // seeing it flash back to 100% for over a second right after mouseup).
  // Holds the just-committed value until the prop actually catches up,
  // instead of falling back to `value` the instant the drag ends.
  const [pendingCommit, setPendingCommit] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (pendingCommit !== null && Math.abs(value - pendingCommit) < 0.001) setPendingCommit(null);
  }, [value, pendingCommit]);
  const displayValue = dragging ? liveValue : (pendingCommit ?? value);

  // Real bug found live (2026-07-15) — this number input used to be bound
  // straight to `displayValue` with no local buffer: typing "155" fired
  // onCommit on every keystroke, and each async commit's eventual prop
  // update snapped the controlled `value` back before the next digit
  // landed, corrupting the result (confirmed: typing "155" into Scale
  // displayed "100" throughout and committed `1` to the server). Same
  // controlled-with-resync-when-unfocused pattern as text-properties-
  // group.tsx's NumberField — the fix already proven correct there.
  const [inputFocused, setInputFocused] = React.useState(false);
  const [localInput, setLocalInput] = React.useState(String(Math.round(value * 100) / 100));
  React.useEffect(() => {
    if (!inputFocused) setLocalInput(mixed && !dragging ? "" : String(Math.round(displayValue * 100) / 100));
  }, [displayValue, mixed, dragging, inputFocused]);

  function scheduleLive(v: number) {
    setLiveValue(v);
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      onLiveChange(v);
    });
  }

  return (
    <div className={`space-y-1 text-caption ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-neutral-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            disabled={disabled}
            className="w-16 rounded-md border border-editor-line bg-editor-surface-1 px-1.5 py-0.5 text-right text-neutral-100 disabled:cursor-not-allowed"
            placeholder={mixed ? "Mixed" : undefined}
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={(e) => {
              setInputFocused(false);
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onCommit(Math.min(max, Math.max(min, v)));
            }}
          />
          {unit && <span className="w-3 text-neutral-500">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={mixed && !dragging ? (min + max) / 2 : displayValue}
        onPointerDown={() => setDragging(true)}
        onChange={(e) => scheduleLive(Number(e.target.value))}
        onPointerUp={(e) => {
          setDragging(false);
          const v = Number((e.target as HTMLInputElement).value);
          setPendingCommit(v);
          onCommit(v);
        }}
        className="w-full accent-editor-accent disabled:cursor-not-allowed disabled:accent-neutral-600"
      />
    </div>
  );
}
