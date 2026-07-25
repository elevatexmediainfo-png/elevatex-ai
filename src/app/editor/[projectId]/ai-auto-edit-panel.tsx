"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CaptionsIcon,
  CheckCircle2,
  Clock,
  Copy,
  Film,
  ImageOff,
  Loader2,
  MessageSquareWarning,
  Music2,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Smile,
  Sparkles,
  Square,
  Volume2,
  X,
  ZoomIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  assetsQueryKey,
  useAddClipMutation,
  useAddTrackMutation,
  useAddTransitionMutation,
  useAiEditJobsQuery,
  useCancelAiEditJobMutation,
  useCreateAiEditJobMutation,
  useDeleteClipMutation,
  useDuplicateClipMutation,
  useEditorAssetsQuery,
  useEditorProjectQuery,
  useGroupClipsMutation,
  useRemoveTrackMutation,
  useRemoveTransitionMutation,
  useReplaceClipSourceMutation,
  useRestoreTransitionMutation,
  useRippleDeleteClipMutation,
  useSplitClipMutation,
  useUngroupClipsMutation,
  useUpdateClipMutation,
  useUpdateProjectAspectRatioMutation,
  useUpdateTrackMutation,
  useUpdateTransitionMutation,
} from "./queries";
import { useEditorStoreApi } from "./store";
import { translateAITimelinePlan, type AITimelineProjectSnapshot, type AITimelineTranslatorDeps } from "./ai-timeline-translator";
import { createAddClipCommand, createAddTrackAndClipCommand } from "./commands";
import { filterAcceptedPlan, itemKey } from "./ai-review-selection";
import { summarizePlanCounts } from "./ai-plan-summary";
import { aiTimelinePlanSchema, AI_ZOOM_SOURCE_CLIP_PLACEHOLDER, type AISceneRemovalReason, type AITimelinePlan } from "@/lib/validations/ai-timeline";
import { AI_STYLE_PRESETS } from "@/lib/validations/ai-style-presets";
import { AI_BROLL_DENSITIES } from "@/lib/validations/video-editor";
import type { AiEditJobStatus, AiEditJobView, AssetView, EditorTrackKind, ProjectView } from "../types";

// Phase 12 Module 8 — same "genuine PATCH, not a display-only toggle"
// aspect-ratio quick-switch as preview-window.tsx's own ASPECT_SWITCH_OPTIONS
// (kept as a second literal copy rather than a shared import: the two
// components' surrounding JSX/sizing differ enough — icon-only square
// buttons in a toolbar strip vs. this panel's labeled intake row — that
// sharing the array would couple two independently-styled UIs to one
// constant for a 3-line list that's unlikely to change).
const ASPECT_SWITCH_OPTIONS: { ratio: "RATIO_16_9" | "RATIO_9_16" | "RATIO_1_1"; label: string; Icon: typeof RectangleHorizontal }[] = [
  { ratio: "RATIO_16_9", label: "Desktop 16:9", Icon: RectangleHorizontal },
  { ratio: "RATIO_9_16", label: "Mobile 9:16", Icon: RectangleVertical },
  { ratio: "RATIO_1_1", label: "Square 1:1", Icon: Square },
];

// Phase 12 Module 2 — the first module where anything actually applies to
// a live project. Deliberately minimal: pick an existing VIDEO/AUDIO
// asset, run the job, watch it progress, review the proposed removals,
// apply them. Full review UI (per-item accept/reject, editing a removal's
// bounds) is later-module polish, not this one's job — this module's job
// is proving transcription -> scene-removal -> real Commands -> real
// timeline change works correctly, via the SAME Command pattern manual
// editing already uses (translateAITimelinePlan + runCommand — see
// ai-timeline-translator.ts, commands.ts).
//
// Phase 12 Module 7 — consolidated every section's rendering onto ONE
// `aiTimelinePlanSchema.safeParse(job.timelinePlan)` result (previously
// 8+ separate inline `as {...}` casts scattered through this file, added
// incrementally module by module) and added a per-item accept/reject
// checkbox to every proposed item across every section. Apply now only
// executes the still-checked subset — see `filterAcceptedPlan` below.
// Inline bounds/content editing (drag-to-reorder, editing a proposal's
// timing before apply) is explicitly OUT of scope here, same discipline
// as every other module's "review, don't rebuild the whole surface" cap.

const STATUS_LABEL: Record<AiEditJobStatus, string> = {
  QUEUED: "Queued",
  UPLOADING: "Preparing",
  TRANSCRIBING: "Transcribing audio",
  ANALYZING_VIDEO: "Analyzing video",
  PLANNING_REMOVALS: "Finding pauses & filler words",
  PLANNING_TIMELINE: "Planning timeline",
  RESOLVING_ASSETS: "Resolving assets",
  BUILDING_TIMELINE: "Building plan",
  READY_FOR_REVIEW: "Ready for review",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const REASON_LABEL: Record<AISceneRemovalReason, string> = {
  silence: "Silence",
  filler_word: "Filler word / stumble",
  bad_take: "Bad take",
  duplicate_take: "Duplicate take",
  quality_issue: "Quality issue",
};

// Phase 12 Module 3 — silence/filler_word come from Module 2's transcript
// analysis; bad_take/duplicate_take/quality_issue come from THIS module's
// Gemini video analysis. Distinct icon + color per reason so a reviewer
// can tell at a glance WHY a cut is proposed and, implicitly, which
// signal caught it (transcript vs. video) — see the founder's own Module
// 3 request to "show the new removal reasons distinctly."
const REASON_ICON: Record<AISceneRemovalReason, React.ComponentType<{ className?: string }>> = {
  silence: Clock,
  filler_word: MessageSquareWarning,
  bad_take: RotateCcw,
  duplicate_take: Copy,
  quality_issue: ImageOff,
};

const REASON_BADGE_CLASS: Record<AISceneRemovalReason, string> = {
  silence: "bg-sky-500/15 text-sky-300",
  filler_word: "bg-amber-500/15 text-amber-300",
  bad_take: "bg-rose-500/15 text-rose-300",
  duplicate_take: "bg-purple-500/15 text-purple-300",
  quality_issue: "bg-orange-500/15 text-orange-300",
};

function formatMs(ms: number): string {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}

// Phase 12 Module 10 — cost/confidence preview, shown before Apply. Reads
// directly off the already-parsed plan (parsed.data), never the live
// checkbox-filtered subset: the vendor cost was already incurred by every
// item this run PROPOSED, whether or not the user ends up keeping it, so
// re-totaling it against accept/reject state would misleadingly imply an
// unchecked item's cost could still be avoided after the fact. `cost` is
// absent on any plan persisted before this field existed — shown as an
// honest "not available" rather than a fabricated retrofit.
function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `<$0.01`;
  return `$${amount.toFixed(2)}`;
}

function AiPlanCostConfidenceSummary({ plan }: { plan: AITimelinePlan }) {
  const counts = summarizePlanCounts(plan);
  const countEntries: { label: string; value: number }[] = [
    { label: "removal", value: counts.sceneRemoval },
    { label: "caption", value: counts.captions },
    { label: "zoom", value: counts.zoom },
    { label: "b-roll item", value: counts.broll },
    { label: "sticker", value: counts.stickers },
    { label: "music track", value: counts.music },
    { label: "sfx", value: counts.sfx },
    { label: "transition", value: counts.transitions },
  ].filter((e) => e.value > 0);

  return (
    <div data-ai-edit-cost-summary className="space-y-1.5 rounded-editor-card border border-editor-line bg-editor-surface-2 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-medium text-neutral-300">This run</span>
        {plan.cost ? (
          <span data-ai-edit-cost-total className="text-micro font-medium text-neutral-100" title="Real vendor cost this pipeline run incurred — transcription + video understanding + reasoning + AI-generated b-roll. Stock b-roll is free.">
            {formatUsd(plan.cost.totalUsd)}
          </span>
        ) : (
          <span className="text-micro text-neutral-500">Cost not available for this run</span>
        )}
      </div>
      {plan.cost && (
        <p className="text-micro text-neutral-500">
          transcription {formatUsd(plan.cost.transcriptionUsd)} · video analysis {formatUsd(plan.cost.videoUnderstandingUsd)} · reasoning{" "}
          {formatUsd(plan.cost.reasoningUsd)} · b-roll generation {formatUsd(plan.cost.brollGenerationUsd)}
          {counts.brollGenerated > 0 && counts.broll > counts.brollGenerated
            ? ` (${counts.brollGenerated} generated, ${counts.broll - counts.brollGenerated} free stock)`
            : ""}
        </p>
      )}
      {countEntries.length > 0 && (
        <p data-ai-edit-plan-counts className="text-micro text-neutral-400">
          {countEntries.map((e) => `${e.value} ${e.label}${e.value === 1 ? "" : "s"}`).join(", ")} proposed
        </p>
      )}
    </div>
  );
}

// Real gap (2026-07-21) — the source-asset picker below never had ANY
// status awareness: a NORMALIZING/UPLOADING/FAILED asset was just as
// selectable as a READY one, unlike the Uploads panel's own asset cards
// (which already show a spinner/warning for the exact same statuses).
// Non-READY assets stay in the list rather than being hidden — the user
// should still see where their upload went — but are disabled with a
// status suffix so they can't actually be run against.
const AI_EDIT_ASSET_STATUS_SUFFIX: Partial<Record<AssetView["status"], string>> = {
  PENDING_UPLOAD: " (Uploading…)",
  QUEUED_FOR_NORMALIZATION: " (Preparing…)",
  NORMALIZING: " (Preparing…)",
  FAILED: " (Failed)",
};

export function AiAutoEditPanel({
  projectId,
  project,
  open,
  onOpenChange,
}: {
  projectId: string;
  project: ProjectView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const assetsQuery = useEditorAssetsQuery(undefined, projectId);
  const jobsQuery = useAiEditJobsQuery(projectId);
  const createJobMutation = useCreateAiEditJobMutation(projectId);
  const projectQuery = useEditorProjectQuery(projectId);
  const updateAspectRatioMutation = useUpdateProjectAspectRatioMutation(projectId);
  const storeApi = useEditorStoreApi();
  const queryClient = useQueryClient();

  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  // Holds the SELECTED PRESET'S value string directly (not its id) — the
  // exact string sent to the reasoning prompt as `stylePreset`, unchanged
  // from what a free-text field used to send.
  const [stylePreset, setStylePreset] = React.useState("");
  // Founder request (2026-07-18) — user control over b-roll aggressiveness.
  // "" (no preference) omits the field entirely, keeping the reasoning
  // adapter's pre-existing BALANCED-equivalent calibration unchanged for
  // every job created before this control existed.
  const [brollDensity, setBrollDensity] = React.useState<"" | (typeof AI_BROLL_DENSITIES)[number]>("");
  const [script, setScript] = React.useState("");
  // Real bug fix (2026-07-18) — covers the auto-add-to-timeline step
  // (ensureSourceAssetOnTimeline) that now runs before job creation; see
  // handleRun's own comment for why this can't just reuse
  // createJobMutation.isPending.
  const [preparingRun, setPreparingRun] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [appliedJobIds, setAppliedJobIds] = React.useState<Set<string>>(new Set());
  const [unresolvedCountByJobId, setUnresolvedCountByJobId] = React.useState<Record<string, number>>({});
  const [applying, setApplying] = React.useState(false);
  // Phase 12 Module 7 — items NOT in this set are checked (accepted) by
  // default; presence means "unchecked." Keyed across every job/section/
  // index at once (itemKey already embeds jobId), so one flat Set is
  // enough — no per-job nesting needed.
  const [deselectedKeys, setDeselectedKeys] = React.useState<Set<string>>(new Set());

  function toggleItem(key: string) {
    setDeselectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const sourceAssets = (assetsQuery.data ?? []).filter((a) => a.kind === "VIDEO" || a.kind === "AUDIO");

  // The SAME mutation-hook-backed deps manual editing's own timeline-panel.tsx
  // builds — the translator only ever calls these, never a raw fetch of
  // its own, so an AI-applied change is indistinguishable from a manual
  // one at the Command layer (and gets the SAME real undo for free, once
  // pushed onto the live undo stack by runCommand below).
  const updateClipMutation = useUpdateClipMutation(projectId);
  const deleteClipMutation = useDeleteClipMutation(projectId);
  const addClipMutation = useAddClipMutation(projectId);
  const splitClipMutation = useSplitClipMutation(projectId);
  const rippleDeleteMutation = useRippleDeleteClipMutation(projectId);
  const duplicateClipMutation = useDuplicateClipMutation(projectId);
  const replaceSourceMutation = useReplaceClipSourceMutation(projectId);
  const groupClipsMutation = useGroupClipsMutation(projectId);
  const ungroupClipsMutation = useUngroupClipsMutation(projectId);
  const restoreTransitionMutation = useRestoreTransitionMutation(projectId);
  const addTrackMutation = useAddTrackMutation(projectId);
  const removeTrackMutation = useRemoveTrackMutation(projectId);
  const updateTrackMutation = useUpdateTrackMutation(projectId);
  const addTransitionMutation = useAddTransitionMutation(projectId);
  const updateTransitionMutation = useUpdateTransitionMutation(projectId);
  const removeTransitionMutation = useRemoveTransitionMutation(projectId);

  const translatorDeps: AITimelineTranslatorDeps = React.useMemo(() => {
    const clip = {
      updateClip: (input: Parameters<typeof updateClipMutation.mutateAsync>[0]) => updateClipMutation.mutateAsync(input),
      deleteClip: (clipId: string) => deleteClipMutation.mutateAsync(clipId),
      addClip: (patch: Parameters<typeof addClipMutation.mutateAsync>[0]) => addClipMutation.mutateAsync(patch),
      splitClip: (input: Parameters<typeof splitClipMutation.mutateAsync>[0]) => splitClipMutation.mutateAsync(input),
      rippleDeleteClip: (clipId: string) => rippleDeleteMutation.mutateAsync(clipId),
      duplicateClip: (clipId: string) => duplicateClipMutation.mutateAsync(clipId),
      replaceClipSource: (input: Parameters<typeof replaceSourceMutation.mutateAsync>[0]) => replaceSourceMutation.mutateAsync(input),
      groupClips: (clipIds: string[]) => groupClipsMutation.mutateAsync(clipIds),
      ungroupClips: (clipIds: string[]) => ungroupClipsMutation.mutateAsync(clipIds),
      restoreTransition: (patch: Parameters<typeof restoreTransitionMutation.mutateAsync>[0]) => restoreTransitionMutation.mutateAsync(patch),
    };
    const track = { updateTrack: (input: Parameters<typeof updateTrackMutation.mutateAsync>[0]) => updateTrackMutation.mutateAsync(input) };
    const addTrackAndClip = {
      ...clip,
      addTrack: (input: Parameters<typeof addTrackMutation.mutateAsync>[0]) => addTrackMutation.mutateAsync(input),
      removeTrack: (trackId: string) => removeTrackMutation.mutateAsync(trackId),
    };
    return {
      clip,
      track,
      addTrackAndClip,
      addMusicTrack: { ...addTrackAndClip, updateTrack: track.updateTrack },
      transition: {
        addTransition: (patch: Parameters<typeof addTransitionMutation.mutateAsync>[0]) => addTransitionMutation.mutateAsync(patch),
        updateTransition: (input: Parameters<typeof updateTransitionMutation.mutateAsync>[0]) => updateTransitionMutation.mutateAsync(input),
        removeTransition: (transitionId: string) => removeTransitionMutation.mutateAsync(transitionId),
      },
    };
  }, [
    updateClipMutation,
    deleteClipMutation,
    addClipMutation,
    splitClipMutation,
    rippleDeleteMutation,
    duplicateClipMutation,
    replaceSourceMutation,
    groupClipsMutation,
    ungroupClipsMutation,
    restoreTransitionMutation,
    addTrackMutation,
    removeTrackMutation,
    updateTrackMutation,
    addTransitionMutation,
    updateTransitionMutation,
    removeTransitionMutation,
  ]);

  // Real bug found live (2026-07-18) — the panel let a user pick a source
  // asset and run the full pipeline (transcribe/analyze/plan) without that
  // asset ever being on the timeline; Apply then failed outright at the
  // very end ("Couldn't find a clip...") with NOTHING applied, even though
  // the review panel showed real proposals. The panel's own description
  // ("transcribes... and proposes a full auto-edit... for you to review
  // and apply") implies a genuine end-to-end flow, not a two-step manual
  // prerequisite the UI never explains. Fixed at the root: auto-add the
  // selected source asset to the timeline the moment "Run AI Auto-Edit" is
  // clicked, if it isn't already there — same reuse-or-create-track
  // resolution timeline-panel.tsx's own drag-drop already uses (an
  // existing unlocked track of the right kind is reused, appending after
  // whatever's already on it; only a genuinely empty project gets a new
  // track), so Apply's own targetClip lookup always finds a real clip.
  async function ensureSourceAssetOnTimeline(assetId: string) {
    const ws = projectQuery.data;
    if (!ws) return;
    if (ws.clips.some((c) => c.assetId === assetId)) return; // already there
    const asset = sourceAssets.find((a) => a.id === assetId);
    if (!asset) return;

    const trackKind: EditorTrackKind = asset.kind === "AUDIO" ? "AUDIO" : "VIDEO";
    // A source AUDIO asset being transcribed is the project's spoken
    // voice track — tagging it VOICE means the AI's own music-ducking
    // proposal (duckingVoiceTrackHint) picks it up automatically, the
    // same "auto: every VOICE track" default manual ducking already uses.
    const audioSubtype = trackKind === "AUDIO" ? "VOICE" : undefined;
    const durationMs = Math.max(1000, Math.round((asset.durationSeconds ?? 0) * 1000));

    const existingTrack = ws.tracks.find((t) => t.kind === trackKind && !t.isLocked);
    if (existingTrack) {
      // Append after whatever's already on this track — never overlap
      // pre-existing content, same non-overlap intent as drag-drop's own
      // clampMoveStart, just simpler (no drop point to clamp toward).
      const clipsOnTrack = ws.clips.filter((c) => c.trackId === existingTrack.id);
      const startMs = clipsOnTrack.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);
      await storeApi.getState().runCommand(createAddClipCommand(translatorDeps.clip, { trackId: existingTrack.id, assetId, startMs, durationMs }));
    } else {
      await storeApi
        .getState()
        .runCommand(createAddTrackAndClipCommand(translatorDeps.addTrackAndClip, { kind: trackKind, audioSubtype }, { assetId, startMs: 0, durationMs }));
    }
    // Real lesson from the earlier silent-Apply-failure investigation:
    // never trust invalidate-only propagation to have landed by the time
    // a LATER read (handleApply's own projectQuery.data lookup) needs it —
    // force a guaranteed fresh fetch so the newly-added clip is visible
    // immediately, not just eventually.
    await projectQuery.refetch();
  }

  async function handleRun() {
    if (!selectedAssetId) return;
    // Defense in depth alongside the picker's own `disabled` options above —
    // covers the narrow window where `selectedAssetId` was set while an
    // asset was still READY-selectable but a subsequent status change
    // hasn't re-rendered yet (e.g. a stale query cache).
    if (sourceAssets.find((a) => a.id === selectedAssetId)?.status !== "READY") return;
    // Guards the button's own disabled state below — ensureSourceAssetOnTimeline
    // is real async work (an addTrack/addClip round trip) that happens BEFORE
    // createJobMutation.isPending would ever flip true on its own, so without
    // this a fast double-click could fire the auto-add twice.
    setPreparingRun(true);
    try {
      await ensureSourceAssetOnTimeline(selectedAssetId);
      await createJobMutation.mutateAsync({
        assetId: selectedAssetId,
        stylePreset: stylePreset.trim() || undefined,
        brollDensity: brollDensity || undefined,
        script: script.trim() || undefined,
      });
    } catch {
      // editorApi() already toast.error()'d the real message (e.g. the new
      // credit/tier precheck this session added) — this catch exists only
      // so that failure doesn't ALSO surface as an unhandled promise
      // rejection here, same as ensureSourceAssetOnTimeline's own errors.
    } finally {
      setPreparingRun(false);
    }
  }

  async function handleApply(job: AiEditJobView) {
    setApplyError(null);
    const parsed = aiTimelinePlanSchema.safeParse(job.timelinePlan);
    if (!parsed.success) {
      setApplyError("The AI's plan failed validation — see console for details.");
      console.error(parsed.error);
      return;
    }
    const ws = projectQuery.data;
    if (!ws) return;
    const targetClip = ws.clips.find((c) => c.assetId === job.sourceAssetId);
    if (!targetClip) {
      setApplyError("Couldn't find a clip in this project using the transcribed asset — add it to the timeline first.");
      return;
    }

    // Phase 12 Module 7 — only the still-checked items go any further;
    // everything below (the remap, translateAITimelinePlan) is otherwise
    // UNCHANGED, it just now receives a smaller plan.
    const accepted = filterAcceptedPlan(job.id, parsed.data, deselectedKeys);

    // sceneRemoval/captions/zoom windows are all SOURCE-relative (0 =
    // start of the raw uploaded file, per the transcript) — remap every
    // section to this clip's own timeline-absolute position, accounting
    // for its startMs and any trim. zoom additionally needs its
    // clipId substituted: the REASONING call (Module 4) can't know the
    // real, server-minted clip id in advance, so it emits
    // AI_ZOOM_SOURCE_CLIP_PLACEHOLDER instead (see that constant's own
    // doc comment) — resolved here, the same moment sceneRemoval's own
    // windows get resolved, right before translateAITimelinePlan() runs.
    const remapMs = (ms: number) => targetClip.startMs + (ms - targetClip.trimStartMs);
    const remapped = {
      ...accepted,
      sceneRemoval: accepted.sceneRemoval.map((r) => ({ ...r, startMs: remapMs(r.startMs), endMs: remapMs(r.endMs) })),
      captions: accepted.captions.map((c) => ({ ...c, startMs: remapMs(c.startMs), endMs: remapMs(c.endMs) })),
      zoom: accepted.zoom.map((z) => ({
        ...z,
        clipId: z.clipId === AI_ZOOM_SOURCE_CLIP_PLACEHOLDER ? targetClip.id : z.clipId,
        startMs: remapMs(z.startMs),
        endMs: remapMs(z.endMs),
      })),
      // Phase 12 Module 5 — resolvedAssetId/resolvedAssetUrl/resolutionNote
      // already carry through untouched from the server-side resolution
      // pass (ai-broll-resolver.ts); only the WINDOW needs remapping here,
      // same as every other section. An item with no resolvedAssetId
      // still gets remapped (harmless) — the translator itself is what
      // turns that into an explicit unresolved-item warning, never a
      // silent drop.
      broll: accepted.broll.map((b) => ({ ...b, startMs: remapMs(b.startMs), endMs: remapMs(b.endMs) })),
      stickers: accepted.stickers.map((s) => ({ ...s, startMs: remapMs(s.startMs), endMs: remapMs(s.endMs) })),
      sfx: accepted.sfx.map((sfx) => ({ ...sfx, atMs: remapMs(sfx.atMs) })),
      transitions: accepted.transitions,
    };

    const snapshot: AITimelineProjectSnapshot = { tracks: ws.tracks, clips: ws.clips, durationMs: ws.project.durationMs };
    const result = translateAITimelinePlan(remapped, snapshot, translatorDeps);
    if (result.warnings.length > 0) console.warn("[AI Auto-Edit] translator warnings:", result.warnings);
    if (!result.command) {
      setApplyError("Nothing to apply — every item was unchecked, or every proposed change fell outside this clip's current range.");
      return;
    }

    setApplying(true);
    try {
      await storeApi.getState().runCommand(result.command);
      setAppliedJobIds((prev) => new Set(prev).add(job.id));
      // Phase 12 Module 5 — items with no resolvedAssetId (a broll slot
      // that failed to resolve) are never silently dropped: the
      // translator pushes them into unresolvedAssets instead of building
      // a command for them. Surfaced here so a partial apply (some items
      // landed, some didn't) is visible, not just "Applied to timeline"
      // with no mention of what got left out.
      if (result.unresolvedAssets.length > 0) {
        setUnresolvedCountByJobId((prev) => ({ ...prev, [job.id]: result.unresolvedAssets.length }));
      }
    } catch (err) {
      // Real bug found live (2026-07-18) — this catch never existed before,
      // so a genuine mid-apply failure (live-reproduced: a "TypeError:
      // Failed to fetch" on ONE of the composite command's many concurrent
      // addTrack/addClip/updateTrack requests — this command fires one
      // request per proposed captions/broll/stickers/sfx/music/transition
      // item, all via createCompositeCommand's Promise.all, no throttling)
      // was completely silent: no error shown, and since Promise.all
      // doesn't roll back already-resolved siblings, whatever DID land
      // server-side (confirmed via direct DB inspection to usually be
      // nearly everything) was orphaned from the client's view until a
      // full reload. Surfacing it here at least tells the founder/user
      // something went wrong instead of a mysteriously "frozen" preview.
      setApplyError(err instanceof Error ? `Apply may have partially failed: ${err.message}. Reload and check the timeline before retrying.` : "Apply may have partially failed. Reload and check the timeline before retrying.");
      console.error("[AI Auto-Edit] apply failed", err);
    } finally {
      // Always refresh, success or failure — closes two real, live-
      // reproduced gaps at once: (1) newly-resolved assets (music/broll/
      // stickers/sfx can all reference a BRAND-NEW EditorAsset materialized
      // by RESOLVING_ASSETS) are invisible in the compositor because
      // `assetById` (preview-window.tsx) reads useEditorAssetsQuery() with
      // NO projectId — a separate cache (["editor","assets"]) nothing else
      // in this chain ever invalidates; (2) on the failure path above,
      // whatever partial work landed server-side is still reflected
      // instead of requiring a manual reload to even see it. Invalidating
      // the unscoped assets key cascades to every project-scoped variant
      // too, via TanStack's own prefix-match invalidation.
      await Promise.all([projectQuery.refetch(), queryClient.invalidateQueries({ queryKey: assetsQueryKey() })]);
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col bg-editor-panel text-white sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Sparkles className="size-4" />
            AI Auto-Edit
          </SheetTitle>
          <SheetDescription className="text-neutral-400">
            Transcribes a video/audio asset and proposes a full auto-edit — removals, captions, zoom, b-roll, stickers, music, sfx, and transitions — for you to review and apply.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b border-editor-line px-4 pb-4">
          <div className="space-y-1">
            <span className="text-caption text-neutral-500">Aspect ratio</span>
            {/* Phase 12 Module 8 — the SAME real project.aspectRatio PATCH
                preview-window.tsx's own quick-switch already uses, not a
                separate AI-only "framing preference": zoom/crop reasoning
                only makes sense against the canvas the export actually
                renders at, so this has to be the one real setting, not a
                second disconnected concept of aspect ratio. */}
            <div className="flex items-center gap-1.5">
              {ASPECT_SWITCH_OPTIONS.map(({ ratio, label, Icon }) => {
                const active = project.aspectRatio === ratio;
                return (
                  <Tooltip key={ratio}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-ai-edit-aspect-ratio={ratio}
                        data-ai-edit-aspect-ratio-active={active}
                        disabled={updateAspectRatioMutation.isPending}
                        onClick={() => updateAspectRatioMutation.mutate(ratio)}
                        className={cn(
                          "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-micro transition-colors disabled:opacity-50",
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
          </div>
          <div className="space-y-1">
            <span className="text-caption text-neutral-500">Source asset</span>
            <select
              className="h-8 w-full rounded-md border border-editor-line bg-editor-surface-1 px-2 text-caption text-neutral-100"
              value={selectedAssetId ?? ""}
              onChange={(e) => setSelectedAssetId(e.target.value || null)}
            >
              <option value="">Choose a video or audio asset…</option>
              {sourceAssets.map((a) => (
                <option key={a.id} value={a.id} disabled={a.status !== "READY"}>
                  {a.originalFilename}
                  {AI_EDIT_ASSET_STATUS_SUFFIX[a.status] ?? ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-caption text-neutral-500">Style preset (optional)</span>
            <select
              data-ai-edit-style-preset
              className="h-8 w-full rounded-md border border-editor-line bg-editor-surface-1 px-2 text-caption text-neutral-100"
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value)}
            >
              <option value="">No preference</option>
              {AI_STYLE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.value} title={preset.description}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-caption text-neutral-500">B-roll density</span>
            {/* Founder request (2026-07-18) — control over how aggressively
                b-roll gets proposed, alongside aspect ratio/style preset
                above. A select matches this panel's own existing pattern
                (Style preset) rather than a slider — consistent, and this
                is a 3-way categorical choice, not a continuous one. */}
            <select
              data-ai-edit-broll-density
              className="h-8 w-full rounded-md border border-editor-line bg-editor-surface-1 px-2 text-caption text-neutral-100"
              value={brollDensity}
              onChange={(e) => setBrollDensity(e.target.value as typeof brollDensity)}
            >
              <option value="">Balanced (default)</option>
              {AI_BROLL_DENSITIES.filter((d) => d !== "BALANCED").map((d) => (
                <option key={d} value={d}>
                  {d === "MINIMAL" ? "Minimal" : "Heavy"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-caption text-neutral-500">Reference script (optional)</span>
            <Textarea
              data-ai-edit-script
              placeholder="Paste a script if you have one — used to correct near-miss caption text, never as a timing source."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-16 resize-y bg-editor-surface-1 text-caption text-neutral-100"
            />
          </div>
          <Button type="button" className="w-full" disabled={!selectedAssetId || preparingRun || createJobMutation.isPending} onClick={() => void handleRun()}>
            {preparingRun || createJobMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Run AI Auto-Edit
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          <p className="pt-3 text-label-sm text-neutral-300">Jobs</p>
          {jobsQuery.isLoading && <p className="text-caption text-neutral-500">Loading…</p>}
          {!jobsQuery.isLoading && (jobsQuery.data?.length ?? 0) === 0 && <p className="text-caption text-neutral-500">No jobs yet.</p>}
          {jobsQuery.data?.map((job) => {
            // Phase 12 Module 7 — ONE typed parse per job, shared by every
            // section below. Replaces the 8+ separate inline `as {...}`
            // casts on the raw `job.timelinePlan` this file used to have,
            // one per section, added incrementally module by module.
            const parsed = job.status === "READY_FOR_REVIEW" ? aiTimelinePlanSchema.safeParse(job.timelinePlan) : null;

            return (
              <div key={job.id} data-ai-edit-job-id={job.id} className="space-y-2 rounded-editor-card border border-editor-line bg-editor-surface-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-caption text-neutral-200">
                    {job.status === "FAILED" ? (
                      <AlertTriangle className="size-3.5 text-editor-danger" />
                    ) : job.status === "READY_FOR_REVIEW" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-400" />
                    ) : job.status === "CANCELLED" ? (
                      <X className="size-3.5 text-neutral-500" />
                    ) : (
                      <Loader2 className="size-3.5 animate-spin text-editor-accent" />
                    )}
                    {STATUS_LABEL[job.status]}
                  </span>
                  <div className="flex items-center gap-2">
                    {job.status !== "READY_FOR_REVIEW" && job.status !== "FAILED" && job.status !== "CANCELLED" && (
                      <CancelJobButton projectId={projectId} jobId={job.id} />
                    )}
                    <span className="text-micro text-neutral-500">{job.progress}%</span>
                  </div>
                </div>

                {job.status === "FAILED" && job.errorMessage && <p className="text-micro text-editor-danger">{job.errorMessage}</p>}

                {job.status === "READY_FOR_REVIEW" && !parsed?.success && (
                  <p className="text-micro text-editor-danger">This job&apos;s plan failed validation and can&apos;t be reviewed — see console for details.</p>
                )}

                {job.status === "READY_FOR_REVIEW" && parsed?.success && (
                  <div className="space-y-1.5">
                    <AiPlanCostConfidenceSummary plan={parsed.data} />
                    {parsed.data.sceneRemoval.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-micro text-neutral-500">
                          {parsed.data.sceneRemoval.length} proposed removal{parsed.data.sceneRemoval.length === 1 ? "" : "s"}
                        </p>
                        <ul data-ai-edit-removal-list className="max-h-40 space-y-1 overflow-y-auto text-micro text-neutral-300">
                          {parsed.data.sceneRemoval.map((r, i) => {
                            const key = itemKey(job.id, "sceneRemoval", i);
                            const checked = !deselectedKeys.has(key);
                            const ReasonIcon = REASON_ICON[r.reason];
                            return (
                              <li
                                key={i}
                                data-ai-edit-removal-item
                                data-ai-edit-removal-reason={r.reason}
                                data-ai-edit-item-checked={checked}
                                className="flex items-center justify-between gap-2 rounded bg-editor-surface-2 px-2 py-1"
                              >
                                <span className="flex items-center gap-2">
                                  <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} />
                                  {formatMs(r.startMs)}–{formatMs(r.endMs)}
                                </span>
                                <span className={cn("flex items-center gap-1 rounded-full px-1.5 py-0.5", REASON_BADGE_CLASS[r.reason])}>
                                  <ReasonIcon className="size-3" />
                                  {REASON_LABEL[r.reason]}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {parsed.data.captions.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                          <CaptionsIcon className="size-3" />
                          {parsed.data.captions.length} proposed caption{parsed.data.captions.length === 1 ? "" : "s"}
                        </p>
                        <ul data-ai-edit-caption-list className="max-h-32 space-y-1 overflow-y-auto text-micro text-neutral-300">
                          {parsed.data.captions.map((c, i) => {
                            const key = itemKey(job.id, "captions", i);
                            const checked = !deselectedKeys.has(key);
                            return (
                              <li key={i} data-ai-edit-caption-item data-ai-edit-item-checked={checked} className="rounded bg-editor-surface-2 px-2 py-1">
                                <div className="flex items-center justify-between gap-2 text-neutral-500">
                                  <span className="flex items-center gap-2">
                                    <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} />
                                    {formatMs(c.startMs)}–{formatMs(c.endMs)}
                                  </span>
                                  <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-300">{c.reveal?.mode ?? "WORD"}</span>
                                </div>
                                <p className="truncate pl-6 text-neutral-200">{c.text}</p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {parsed.data.zoom.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                          <ZoomIn className="size-3" />
                          {parsed.data.zoom.length} proposed zoom{parsed.data.zoom.length === 1 ? "" : "s"}
                        </p>
                        <ul data-ai-edit-zoom-list className="max-h-32 space-y-1 overflow-y-auto text-micro text-neutral-300">
                          {parsed.data.zoom.map((z, i) => {
                            const key = itemKey(job.id, "zoom", i);
                            const checked = !deselectedKeys.has(key);
                            return (
                              <li
                                key={i}
                                data-ai-edit-zoom-item
                                data-ai-edit-item-checked={checked}
                                className="flex items-center justify-between gap-2 rounded bg-editor-surface-2 px-2 py-1"
                              >
                                <span className="flex items-center gap-2">
                                  <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} />
                                  {formatMs(z.startMs)}–{formatMs(z.endMs)}
                                </span>
                                <span className="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-purple-300">
                                  {Math.round(z.scaleFrom)}% → {Math.round(z.scaleTo)}%
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {parsed.data.broll.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                          <Film className="size-3" />
                          {parsed.data.broll.length} proposed b-roll
                        </p>
                        <ul data-ai-edit-broll-list className="space-y-1 text-micro text-neutral-300">
                          {parsed.data.broll.map((b, i) => {
                            const key = itemKey(job.id, "broll", i);
                            const checked = !deselectedKeys.has(key);
                            return (
                              <li
                                key={i}
                                data-ai-edit-broll-item
                                data-ai-edit-broll-resolved={!!b.resolvedAssetId}
                                data-ai-edit-item-checked={checked}
                                className="flex items-center gap-2 rounded bg-editor-surface-2 px-2 py-1"
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} className="shrink-0" />
                                {b.resolvedAssetUrl ? (
                                  <img src={b.resolvedAssetUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
                                ) : (
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded bg-editor-surface-1 text-editor-danger">
                                    <AlertTriangle className="size-3.5" />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2 text-neutral-500">
                                    <span>
                                      {formatMs(b.startMs)}–{formatMs(b.endMs)}
                                    </span>
                                    <span className={cn("rounded-full px-1.5 py-0.5", b.source === "stock" ? "bg-teal-500/15 text-teal-300" : "bg-fuchsia-500/15 text-fuchsia-300")}>
                                      {b.source}
                                    </span>
                                  </div>
                                  <p className="truncate text-neutral-200">{b.searchQuery ?? b.generation?.prompt}</p>
                                  {b.resolutionNote && <p className="truncate text-editor-danger">Not resolved: {b.resolutionNote}</p>}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {parsed.data.stickers.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                          <Smile className="size-3" />
                          {parsed.data.stickers.length} proposed sticker{parsed.data.stickers.length === 1 ? "" : "s"}
                        </p>
                        <ul data-ai-edit-sticker-list className="space-y-1 text-micro text-neutral-300">
                          {parsed.data.stickers.map((s, i) => {
                            const key = itemKey(job.id, "stickers", i);
                            const checked = !deselectedKeys.has(key);
                            return (
                              <li
                                key={i}
                                data-ai-edit-sticker-item
                                data-ai-edit-sticker-resolved={!!s.assetId}
                                data-ai-edit-item-checked={checked}
                                className="flex items-center gap-2 rounded bg-editor-surface-2 px-2 py-1"
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} className="shrink-0" />
                                {s.resolvedAssetUrl ? (
                                  <img src={s.resolvedAssetUrl} alt="" className="size-6 shrink-0 rounded object-cover" />
                                ) : (
                                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-editor-surface-1 text-editor-danger">
                                    <AlertTriangle className="size-3" />
                                  </span>
                                )}
                                <span className="text-neutral-500">
                                  {formatMs(s.startMs)}–{formatMs(s.endMs)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-neutral-200">{s.assetQuery}</span>
                                {s.resolutionNote && <p className="w-full truncate text-editor-danger">Not resolved: {s.resolutionNote}</p>}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {parsed.data.music &&
                      (() => {
                        const m = parsed.data.music!;
                        const key = itemKey(job.id, "music", 0);
                        const checked = !deselectedKeys.has(key);
                        return (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                              <Music2 className="size-3" />1 proposed music track
                            </p>
                            <div data-ai-edit-music data-ai-edit-music-resolved={!!m.assetId} data-ai-edit-item-checked={checked} className="rounded bg-editor-surface-2 px-2 py-1 text-micro text-neutral-300">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2">
                                  <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} className="shrink-0" />
                                  <span className="truncate text-neutral-200">{m.searchQuery}</span>
                                </span>
                                {m.duckingEnabled !== false && <span className="shrink-0 rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-indigo-300">ducking on</span>}
                              </div>
                              {m.resolutionNote && <p className="truncate text-editor-danger">Not resolved: {m.resolutionNote}</p>}
                            </div>
                          </div>
                        );
                      })()}

                    {parsed.data.sfx.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                          <Volume2 className="size-3" />
                          {parsed.data.sfx.length} proposed sfx
                        </p>
                        <ul data-ai-edit-sfx-list className="space-y-1 text-micro text-neutral-300">
                          {parsed.data.sfx.map((s, i) => {
                            const key = itemKey(job.id, "sfx", i);
                            const checked = !deselectedKeys.has(key);
                            return (
                              <li
                                key={i}
                                data-ai-edit-sfx-item
                                data-ai-edit-sfx-resolved={!!s.assetId}
                                data-ai-edit-item-checked={checked}
                                className="flex items-center justify-between gap-2 rounded bg-editor-surface-2 px-2 py-1"
                              >
                                <span className="flex items-center gap-2">
                                  <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} />
                                  {formatMs(s.atMs)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-neutral-200">{s.assetQuery}</span>
                                {!s.assetId && <AlertTriangle className="size-3 shrink-0 text-editor-danger" />}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {parsed.data.transitions.length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 pt-1 text-micro text-neutral-500">
                          <ArrowRightLeft className="size-3" />
                          {parsed.data.transitions.length} proposed transition{parsed.data.transitions.length === 1 ? "" : "s"}
                        </p>
                        <ul data-ai-edit-transition-list className="space-y-1 text-micro text-neutral-300">
                          {parsed.data.transitions.map((t, i) => {
                            const key = itemKey(job.id, "transitions", i);
                            const checked = !deselectedKeys.has(key);
                            return (
                              <li
                                key={i}
                                data-ai-edit-transition-item
                                data-ai-edit-item-checked={checked}
                                className="flex items-center justify-between gap-2 rounded bg-editor-surface-2 px-2 py-1"
                              >
                                <span className="flex items-center gap-2 text-neutral-200">
                                  <Checkbox checked={checked} onCheckedChange={() => toggleItem(key)} />
                                  {t.type}
                                </span>
                                <span className="rounded-full bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300">{t.durationMs}ms</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {job.planningError && (
                      <p className="flex items-start gap-1 text-micro text-amber-400">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                        Timeline planning failed: {job.planningError} — scene removal proposals above are still valid and applicable.
                      </p>
                    )}

                    {appliedJobIds.has(job.id) ? (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 text-micro text-emerald-400">
                          <CheckCircle2 className="size-3" /> Applied to timeline
                        </p>
                        {unresolvedCountByJobId[job.id] > 0 && (
                          <p className="flex items-start gap-1 text-micro text-amber-400">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                            {unresolvedCountByJobId[job.id]} item{unresolvedCountByJobId[job.id] === 1 ? "" : "s"} couldn&apos;t be applied (unresolved b-roll/sticker/music/sfx — see above).
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button type="button" variant="secondary" size="sm" className="w-full" disabled={applying} data-ai-edit-apply-button onClick={() => void handleApply(job)}>
                        {applying ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Apply to timeline
                      </Button>
                    )}
                    {applyError && <p className="text-micro text-editor-danger">{applyError}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Real bug fix (2026-07-24, found live during the codebase health check) —
// this pipeline had no way to cancel a stuck/wrong-asset job at all before
// this; the user's only recourse was waiting for the (also new) stale-job
// reaper to eventually time it out. Mirrors the Export panel's own cancel
// affordance.
function CancelJobButton({ projectId, jobId }: { projectId: string; jobId: string }) {
  const cancelMutation = useCancelAiEditJobMutation(projectId);
  return (
    <button
      type="button"
      title="Cancel this job"
      disabled={cancelMutation.isPending}
      onClick={() => cancelMutation.mutate(jobId)}
      className="text-neutral-500 hover:text-editor-danger disabled:opacity-50"
    >
      {cancelMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
    </button>
  );
}
