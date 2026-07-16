import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { editorApi } from "../api-client";
import type {
  AssetView,
  ClipView,
  EditorAudioSubtype,
  EditorExportCodec,
  EditorExportFormat,
  EditorExportResolution,
  EditorTrackKind,
  ExportPresetView,
  ExportView,
  MarkerView,
  ProjectView,
  TrackView,
  TransitionView,
  VersionView,
} from "../types";
import type { ClipTransform } from "@/lib/video-editor/transform";
import { computePeaksFromChannelData } from "@/lib/video-editor/audio";
import type { TransitionDirection, TransitionEasing, TransitionType } from "@/lib/video-editor/transition-engine";
import type { PricingTierLevel } from "@/lib/credits/video-actions";

// TanStack Query hooks for the Cloud Video Editor workspace (Milestone 24).
// Server state only — every panel that needs tracks/clips/assets calls
// these directly rather than threading them through props/context; React
// Query dedupes by queryKey, so the workspace shell seeding `initialData`
// once is enough for every other caller of the same key to share it.

export interface ProjectWorkspaceData {
  project: ProjectView;
  tracks: TrackView[];
  clips: ClipView[];
  markers: MarkerView[];
  transitions: TransitionView[];
}

function projectQueryKey(projectId: string) {
  return ["editor", "project", projectId] as const;
}

export function useEditorProjectQuery(projectId: string, initialData?: ProjectWorkspaceData) {
  return useQuery({
    queryKey: projectQueryKey(projectId),
    queryFn: () => editorApi<ProjectWorkspaceData>(`/api/editor/projects/${projectId}`, "GET"),
    initialData,
  });
}

// Fix (2026-07-12) — `assetsQueryKey()` (no args) stays the base prefix so
// every existing `invalidateQueries({ queryKey: assetsQueryKey() })` call
// below keeps invalidating every variant of this query via TanStack Query's
// default prefix matching — including the new project-scoped one, whose key
// extends this same array rather than replacing it.
function assetsQueryKey(projectId?: string) {
  return projectId ? (["editor", "assets", projectId] as const) : (["editor", "assets"] as const);
}

// `projectId`, when passed, scopes this to just that project's own uploads
// (the Uploads tab's real use) — omitted, this preserves the exact prior
// cross-project behavior every other caller (timeline-panel.tsx's own
// clip-asset resolution and "Replace source" candidate list) still needs;
// see listEditorAssets' own doc comment for why that's intentional.
export function useEditorAssetsQuery(initialData?: AssetView[], projectId?: string) {
  return useQuery({
    queryKey: assetsQueryKey(projectId),
    queryFn: () =>
      editorApi<{ assets: AssetView[] }>(`/api/editor/assets${projectId ? `?projectId=${projectId}` : ""}`, "GET").then((d) => d.assets),
    initialData,
  });
}

function useInvalidateProject(projectId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
}

export function useAddTrackMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ kind, audioSubtype }: { kind: EditorTrackKind; audioSubtype?: EditorAudioSubtype }) =>
      editorApi<{ track: TrackView }>(`/api/editor/projects/${projectId}/tracks`, "POST", { kind, audioSubtype }),
    onSuccess: invalidate,
  });
}

// Preview window's aspect-ratio quick-switch (Desktop 16:9 / Mobile 9:16 /
// Square 1:1) — PATCHes the real, stored project.aspectRatio; the server
// derives widthPx/heightPx from it (never trusts a client-sent pair), so
// this genuinely changes the compositor's/Export Engine's output dimensions,
// not just a display label.
export function useUpdateProjectAspectRatioMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (aspectRatio: "RATIO_16_9" | "RATIO_9_16" | "RATIO_1_1") =>
      editorApi<{ project: ProjectView }>(`/api/editor/projects/${projectId}`, "PATCH", { aspectRatio }),
    onSuccess: invalidate,
  });
}

export interface UpdateTrackPatch {
  isMuted?: boolean;
  isHidden?: boolean;
  isLocked?: boolean;
  heightPx?: number;
  soloed?: boolean;
  duckingEnabled?: boolean;
  duckingAmountDb?: number;
  duckingFadeMs?: number;
  duckingVoiceTrackIds?: string[];
}

// Real bug found live (2026-07-15) — Mute/Solo/Hide/Lock (TrackHeader's own
// buttons) round-trip through this mutation with no optimistic update, so
// the icon only flips once the PATCH + query invalidation + refetch fully
// land: measured live at 1.4s-4s per click, nowhere close to the
// "immediate" toggle feel every other DAW/NLE gives these controls. Adds
// the standard TanStack Query optimistic-update triad — onMutate cancels
// any in-flight refetch and writes the patch into the cache immediately
// (so the icon flips on the same tick as the click), onError rolls back to
// the pre-click snapshot, onSettled reconciles with the server's real
// state either way. Scoped to this one mutation (not every mutation in
// this file) since track toggles are the one interaction here that's a
// single click with an obvious, cheap, fully-reversible boolean flip —
// the exact shape optimistic updates suit best.
export function useUpdateTrackMutation(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ trackId, patch }: { trackId: string; patch: UpdateTrackPatch }) =>
      editorApi<{ track: TrackView }>(`/api/editor/projects/${projectId}/tracks/${trackId}`, "PATCH", patch),
    onMutate: async ({ trackId, patch }) => {
      await queryClient.cancelQueries({ queryKey: projectQueryKey(projectId) });
      const previous = queryClient.getQueryData<ProjectWorkspaceData>(projectQueryKey(projectId));
      if (previous) {
        queryClient.setQueryData<ProjectWorkspaceData>(projectQueryKey(projectId), {
          ...previous,
          tracks: previous.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(projectQueryKey(projectId), context.previous);
    },
    onSettled: invalidate,
  });
}

export function useRemoveTrackMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (trackId: string) => editorApi(`/api/editor/projects/${projectId}/tracks/${trackId}`, "DELETE"),
    onSuccess: invalidate,
  });
}

// Track reordering (2026-07-15) — same optimistic-update treatment as
// useUpdateTrackMutation above and for the same reason: the drag gesture
// itself already feels live via direct DOM writes (rAF-batched, mirroring
// every other Timeline drag), but the settled result after release should
// feel just as instant, not wait out the PATCH + refetch round trip.
// Reorders the CACHE's own track list client-side using the exact same
// splice-out/splice-in the server's reorderTrack() does, so what the user
// sees immediately after releasing the drag already matches what the
// server will confirm.
export function useReorderTrackMutation(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ trackId, targetIndex }: { trackId: string; targetIndex: number }) =>
      editorApi<{ tracks: { id: string; order: number }[] }>(`/api/editor/projects/${projectId}/tracks/${trackId}/reorder`, "POST", { targetIndex }),
    onMutate: async ({ trackId, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: projectQueryKey(projectId) });
      const previous = queryClient.getQueryData<ProjectWorkspaceData>(projectQueryKey(projectId));
      if (previous) {
        // Same splice-out/splice-in reorderTrack() does server-side: the
        // ORIGINAL pool of order values (by position, ascending) gets
        // reassigned to the NEW sequence, rather than inventing fresh ones.
        const previousSorted = [...previous.tracks].sort((a, b) => a.order - b.order);
        const fromIndex = previousSorted.findIndex((t) => t.id === trackId);
        if (fromIndex !== -1) {
          const clampedTarget = Math.max(0, Math.min(previousSorted.length - 1, targetIndex));
          const reordered = [...previousSorted];
          const [moved] = reordered.splice(fromIndex, 1);
          reordered.splice(clampedTarget, 0, moved);
          const newOrderById = new Map(reordered.map((t, i) => [t.id, previousSorted[i].order]));
          queryClient.setQueryData<ProjectWorkspaceData>(projectQueryKey(projectId), {
            ...previous,
            tracks: previous.tracks.map((t) => ({ ...t, order: newOrderById.get(t.id) ?? t.order })),
          });
        }
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(projectQueryKey(projectId), context.previous);
    },
    onSettled: invalidate,
  });
}

export interface AddClipPatch {
  trackId: string;
  assetId?: string;
  startMs: number;
  durationMs: number;
  trimStartMs?: number;
  content?: Record<string, unknown>;
  transform?: ClipTransform;
}

export function useAddClipMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (patch: AddClipPatch) =>
      editorApi<{ clip: ClipView }>(`/api/editor/projects/${projectId}/clips`, "POST", patch),
    onSuccess: invalidate,
  });
}

export interface UpdateClipPatch {
  trackId?: string;
  startMs?: number;
  durationMs?: number;
  trimStartMs?: number;
  content?: Record<string, unknown>;
  transform?: ClipTransform;
}

export function useUpdateClipMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    // prunedTransitions (2026-07-16) — any transition the server had to
    // auto-remove as a side effect of this move/trim (see clips.ts's
    // updateClip), so Move/Trim's own undo (commands.ts) can restore it
    // if the position lands back where it was valid.
    mutationFn: ({ clipId, patch }: { clipId: string; patch: UpdateClipPatch }) =>
      editorApi<{ clip: ClipView; prunedTransitions: TransitionView[] }>(`/api/editor/projects/${projectId}/clips/${clipId}`, "PATCH", patch),
    onSuccess: invalidate,
  });
}

export function useDeleteClipMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (clipId: string) => editorApi(`/api/editor/projects/${projectId}/clips/${clipId}`, "DELETE"),
    onSuccess: invalidate,
  });
}

// Module 2 — Timeline core operations.

export function useSplitClipMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ clipId, offsetMs }: { clipId: string; offsetMs: number }) =>
      editorApi<{ first: ClipView; second: ClipView }>(`/api/editor/projects/${projectId}/clips/${clipId}/split`, "POST", {
        offsetMs,
      }),
    onSuccess: invalidate,
  });
}

export function useRippleDeleteClipMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (clipId: string) =>
      editorApi<{ clips: ClipView[] }>(`/api/editor/projects/${projectId}/clips/${clipId}/ripple-delete`, "POST"),
    onSuccess: invalidate,
  });
}

export function useDuplicateClipMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (clipId: string) =>
      editorApi<{ clip: ClipView }>(`/api/editor/projects/${projectId}/clips/${clipId}/duplicate`, "POST"),
    onSuccess: invalidate,
  });
}

export function useReplaceClipSourceMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ clipId, assetId }: { clipId: string; assetId: string }) =>
      editorApi<{ clip: ClipView }>(`/api/editor/projects/${projectId}/clips/${clipId}/replace-source`, "PATCH", { assetId }),
    onSuccess: invalidate,
  });
}

export function useGroupClipsMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (clipIds: string[]) =>
      editorApi<{ clips: ClipView[] }>(`/api/editor/projects/${projectId}/clips/group`, "POST", { clipIds }),
    onSuccess: invalidate,
  });
}

export function useUngroupClipsMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (clipIds: string[]) =>
      editorApi<{ clips: ClipView[] }>(`/api/editor/projects/${projectId}/clips/ungroup`, "POST", { clipIds }),
    onSuccess: invalidate,
  });
}

export function useAddMarkerMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (timeMs: number) =>
      editorApi<{ marker: MarkerView }>(`/api/editor/projects/${projectId}/markers`, "POST", { timeMs }),
    onSuccess: invalidate,
  });
}

export function useRemoveMarkerMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (markerId: string) => editorApi(`/api/editor/projects/${projectId}/markers/${markerId}`, "DELETE"),
    onSuccess: invalidate,
  });
}

// Module 9 — Transitions.

export interface AddTransitionPatch {
  trackId: string;
  clipAId: string;
  clipBId: string;
  type: TransitionType;
  direction?: TransitionDirection;
  durationMs: number;
  easing?: TransitionEasing;
}

export interface UpdateTransitionPatch {
  type?: TransitionType;
  direction?: TransitionDirection | null;
  durationMs?: number;
  easing?: TransitionEasing;
}

export function useAddTransitionMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (patch: AddTransitionPatch) =>
      editorApi<{ transition: TransitionView }>(`/api/editor/projects/${projectId}/transitions`, "POST", patch),
    onSuccess: invalidate,
  });
}

// Full Regression Pass follow-up fix (2026-07-16) — used ONLY by Move/Trim's
// own undo (commands.ts's restorePrunedTransitions) to bring back a
// transition pruned as a side effect of the move/trim being reversed. NOT
// the same server operation as useAddTransitionMutation above — see the
// restore route's own doc comment for why a gap-free-adjacency-expecting
// endpoint can't be reused here.
export function useRestoreTransitionMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (patch: AddTransitionPatch) =>
      editorApi<{ transition: TransitionView }>(`/api/editor/projects/${projectId}/transitions/restore`, "POST", patch),
    onSuccess: invalidate,
  });
}

export function useUpdateTransitionMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: ({ transitionId, patch }: { transitionId: string; patch: UpdateTransitionPatch }) =>
      editorApi<{ transition: TransitionView }>(`/api/editor/projects/${projectId}/transitions/${transitionId}`, "PATCH", patch),
    onSuccess: invalidate,
  });
}

export function useRemoveTransitionMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (transitionId: string) => editorApi(`/api/editor/projects/${projectId}/transitions/${transitionId}`, "DELETE"),
    onSuccess: invalidate,
  });
}

// Module 5 — Version History.

function versionsQueryKey(projectId: string) {
  return ["editor", "project", projectId, "versions"] as const;
}

export function useVersionsQuery(projectId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: versionsQueryKey(projectId),
    queryFn: () => editorApi<{ versions: VersionView[] }>(`/api/editor/projects/${projectId}/versions`, "GET").then((d) => d.versions),
    enabled: options.enabled ?? true,
  });
}

// Called by the autosave hook's periodic/command-count timer — not user
// facing, so no toast/invalidate on success (the Version History panel
// refetches its own list when opened).
export function useCreateVersionMutation(projectId: string) {
  return useMutation({
    mutationFn: (label?: string) =>
      editorApi<{ created: boolean; version: { id: string; createdAt: string } | null }>(
        `/api/editor/projects/${projectId}/versions`,
        "POST",
        { label }
      ),
  });
}

export function useRestoreVersionMutation(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      editorApi<{ preRestoreVersionId: string }>(`/api/editor/projects/${projectId}/versions/${versionId}/restore`, "POST"),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: versionsQueryKey(projectId) });
    },
  });
}

// Uploads a File through the presigned-URL flow (mint URL → PUT bytes →
// confirm) in one mutation — the Media Library's upload button just needs
// a File and a kind, not three separate calls to orchestrate.
//
// Fix (2026-07-12) — takes an optional `projectId` now, stamped onto the
// created EditorAsset so it only ever shows up in THIS project's Uploads
// tab (see EditorAsset.projectId's schema doc comment for the bug this
// closes). Deliberately optional, not required like every other project-
// scoped mutation hook's `projectId`: Brand Kit's own font-upload slot
// (brand-kit-section.tsx) also calls this for FONT-kind assets that are
// meant to stay available across every project (a brand font, unlike a
// project's own media upload, isn't tied to one project) — omitting it
// there preserves that intentionally-global behavior unchanged.
export function useUploadEditorAssetMutation(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: AssetView["kind"] }) => {
      const { assetId, uploadUrl } = await editorApi<{ assetId: string; uploadUrl: string }>(
        "/api/editor/assets/upload-url",
        "POST",
        { filename: file.name, contentType: file.type, kind, fileSizeBytes: file.size, projectId }
      );

      const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("Upload failed. Please try again.");

      const metadata = await readClientMediaMetadata(file, kind);
      return editorApi<{ asset: AssetView }>(`/api/editor/assets/${assetId}/confirm-upload`, "POST", metadata);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetsQueryKey() }),
  });
}

// Reads duration/dimensions client-side (the browser already decodes the
// file to preview it) rather than a server-side ffprobe step — same
// pragmatic approach the existing AI editor's upload flow uses. Module 8 —
// AUDIO additionally gets a one-time Web Audio decode to precompute
// waveform peaks (computePeaksFromChannelData, lib/video-editor/audio.ts),
// stored on the asset so ClipBlock's <canvas> never has to re-decode or
// re-fetch the source file to render a waveform.
function readClientMediaMetadata(
  file: File,
  kind: AssetView["kind"]
): Promise<{ durationSeconds?: number; widthPx?: number; heightPx?: number; waveformPeaks?: number[] }> {
  if (kind === "IMAGE") {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ widthPx: img.naturalWidth, heightPx: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = URL.createObjectURL(file);
    });
  }
  if (kind === "VIDEO" || kind === "AUDIO") {
    return new Promise((resolve) => {
      const el = document.createElement(kind === "VIDEO" ? "video" : "audio");
      el.preload = "metadata";
      el.onloadedmetadata = async () => {
        const videoEl = el as HTMLVideoElement;
        const base = {
          durationSeconds: el.duration,
          widthPx: videoEl.videoWidth || undefined,
          heightPx: videoEl.videoHeight || undefined,
        };
        if (kind !== "AUDIO") {
          resolve(base);
          return;
        }
        try {
          const waveformPeaks = await computeWaveformPeaksForFile(file);
          resolve({ ...base, waveformPeaks });
        } catch {
          // Peak generation is best-effort — an asset without peaks still
          // uploads fine, ClipBlock just falls back to a flat placeholder
          // (see ClipBlock's waveform rendering).
          resolve(base);
        }
      };
      el.onerror = () => resolve({});
      el.src = URL.createObjectURL(file);
    });
  }
  return Promise.resolve({});
}

// Decodes the WHOLE file via Web Audio (decodeAudioData needs the full
// ArrayBuffer, not a streamed element) purely to read its channel data for
// peak generation — this is a one-time cost at upload time, not something
// that runs during playback or on every render, so the full-file decode is
// an acceptable trade-off (same "one Web Audio decode, then done" pattern
// most consumer waveform tools use for local peak generation).
async function computeWaveformPeaksForFile(file: File): Promise<number[]> {
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextCtor();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) channelData.push(audioBuffer.getChannelData(i));
    return computePeaksFromChannelData(channelData);
  } finally {
    void ctx.close();
  }
}

export function useDeleteEditorAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => editorApi(`/api/editor/assets/${assetId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetsQueryKey() }),
  });
}

// Module 7 — Text Editor's font picker. Long staleTime since the font
// catalog (Google's, or the admin fallback list) changes rarely and the
// route itself already caches the Google Fonts response server-side.
export function useEditorFontsQuery() {
  return useQuery({
    queryKey: ["editor", "fonts"] as const,
    queryFn: () => editorApi<{ fonts: { id: string; label: string; family: string }[]; source: "google" | "fallback" }>("/api/editor/fonts", "GET"),
    staleTime: 60 * 60 * 1000,
  });
}

// Module 7 — Subtitle track's "Caption template" picker.
export interface CaptionStylePreset {
  id: string;
  label: string;
  style: Record<string, unknown>;
}
export function useCaptionPresetsQuery() {
  return useQuery({
    queryKey: ["editor", "caption-presets"] as const,
    queryFn: () => editorApi<{ presets: CaptionStylePreset[] }>("/api/editor/caption-presets", "GET").then((d) => d.presets),
    staleTime: 60 * 60 * 1000,
  });
}

// Module 10 — Export Engine.

export interface CreateExportInput {
  format: EditorExportFormat;
  resolution: EditorExportResolution;
  fps: number;
  bitrateKbps?: number;
  codec?: EditorExportCodec;
  watermark?: boolean;
}

function exportsQueryKey(projectId: string) {
  return ["editor", "project", projectId, "exports"] as const;
}

// Part C — export history. Polls every few seconds WHILE any export is
// still QUEUED/RENDERING (progress tracking, Part B) and stops polling
// once everything has settled into a terminal state — no point hammering
// the server once nothing is actively rendering.
export function useExportsQuery(projectId: string) {
  return useQuery({
    queryKey: exportsQueryKey(projectId),
    queryFn: () => editorApi<{ exports: ExportView[] }>(`/api/editor/projects/${projectId}/exports`, "GET").then((d) => d.exports),
    refetchInterval: (query) => {
      const stillActive = query.state.data?.some((e) => e.status === "QUEUED" || e.status === "RENDERING");
      return stillActive ? 2000 : false;
    },
  });
}

export function useCreateExportMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExportInput) =>
      editorApi<{ export: ExportView }>(`/api/editor/projects/${projectId}/exports`, "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exportsQueryKey(projectId) }),
  });
}

export function useCancelExportMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exportId: string) => editorApi(`/api/editor/projects/${projectId}/exports/${exportId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exportsQueryKey(projectId) }),
  });
}

export function useExportDownloadUrlMutation(projectId: string) {
  return useMutation({
    mutationFn: (exportId: string) =>
      editorApi<{ url: string; expiresAt: string }>(`/api/editor/projects/${projectId}/exports/${exportId}/download`, "GET"),
  });
}

// Render Queue polish (2026-07-16) — user-scoped (not project-scoped, see
// the Prisma schema's EditorExportPreset doc comment), so the query key
// deliberately has no `projectId` in it — the same saved presets list is
// valid across every project's Export panel.
export interface CreateExportPresetInput {
  name: string;
  format: EditorExportFormat;
  resolution: EditorExportResolution;
  fps: number;
  bitrateKbps?: number;
  codec?: EditorExportCodec;
  watermark?: boolean;
}

// Current user's subscription tier (2026-07-16) — user-scoped, not
// project-scoped, same shape as the export-presets query right below.
// Only real client-side consumer today: the export panel's watermark
// toggle UI gate (canRemoveWatermark, lib/video-editor/exports.ts, is the
// actual server-side enforcement this merely mirrors for a responsive UI).
const currentUserQueryKey = ["editor", "current-user"] as const;

export function useCurrentUserTierQuery() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => editorApi<{ tier: PricingTierLevel | null }>("/api/me", "GET").then((d) => d.tier),
    staleTime: 60_000,
  });
}

const exportPresetsQueryKey = ["editor", "export-presets"] as const;

export function useExportPresetsQuery() {
  return useQuery({
    queryKey: exportPresetsQueryKey,
    queryFn: () => editorApi<{ presets: ExportPresetView[] }>("/api/editor/export-presets", "GET").then((d) => d.presets),
  });
}

export function useCreateExportPresetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExportPresetInput) => editorApi<{ preset: ExportPresetView }>("/api/editor/export-presets", "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exportPresetsQueryKey }),
  });
}

export function useDeleteExportPresetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (presetId: string) => editorApi(`/api/editor/export-presets/${presetId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exportPresetsQueryKey }),
  });
}

// Module 11 — Creative Studio Sidebar's library-only tabs (Templates/
// Transitions/Effects/Shapes/Stickers/Logos), reading the SAME
// listLibraryAssets() the Admin Asset Library uses, via the new
// user-facing (not admin-gated) GET /api/editor/library-assets route.
export interface LibraryAssetView {
  id: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "ANIMATION";
  category: string;
  status: "PENDING_UPLOAD" | "READY" | "FAILED";
  url: string;
  thumbnailUrl: string | null;
  originalFilename: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  waveformPeaks: number[] | null;
  createdAt: string;
}

export function useLibraryAssetsQuery(category: string, q?: string) {
  return useQuery({
    queryKey: ["editor", "library-assets", category, q ?? ""] as const,
    queryFn: () => {
      const params = new URLSearchParams({ category, limit: "60" });
      if (q) params.set("q", q);
      return editorApi<{ assets: LibraryAssetView[]; total: number }>(`/api/editor/library-assets?${params.toString()}`, "GET");
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Module 11 — Part A: live stock search (Pexels/Pixabay/IconScout) against
// lib/providers/stock-media/search-service.ts. `outcomes` is per-provider
// so one provider erroring never hides another's results (Promise.allSettled
// under the hood, not Promise.all).
export interface StockSearchResultView {
  externalId: string;
  title: string;
  previewUrl: string;
  downloadUrl: string;
  kind: string;
  attribution?: string;
  widthPx?: number;
  heightPx?: number;
  durationSeconds?: number;
}
export interface StockSearchOutcome {
  providerId: string;
  results: StockSearchResultView[];
  error?: string;
}

export function useStockSearchQuery(
  category: "STOCK_MEDIA" | "ICON",
  query: string,
  opts: { type?: string; page?: number } = {}
) {
  return useQuery({
    queryKey: ["editor", "stock-search", category, query, opts.type ?? "", opts.page ?? 1] as const,
    queryFn: () => {
      const params = new URLSearchParams({ category, query });
      if (opts.type) params.set("type", opts.type);
      if (opts.page) params.set("page", String(opts.page));
      return editorApi<{ outcomes: StockSearchOutcome[] }>(`/api/editor/stock/search?${params.toString()}`, "GET");
    },
    enabled: query.trim().length > 0,
    staleTime: 60 * 1000,
  });
}

export function useMaterializeStockAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { providerId: string; category: "STOCK_MEDIA" | "ICON"; result: StockSearchResultView }) =>
      editorApi<{ asset: AssetView }>("/api/editor/stock/materialize", "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assetsQueryKey() }),
  });
}

// Module 11 — Part D: favorites, recent, collections.
export function useFavoritesQuery() {
  return useQuery({
    queryKey: ["editor", "favorites"] as const,
    queryFn: () => editorApi<{ assets: AssetView[] }>("/api/editor/favorites", "GET").then((d) => d.assets),
  });
}

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => editorApi<{ favorited: boolean }>(`/api/editor/favorites/${assetId}`, "POST"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editor", "favorites"] }),
  });
}

export function useRecentAssetsQuery() {
  return useQuery({
    queryKey: ["editor", "recent"] as const,
    queryFn: () => editorApi<{ assets: AssetView[] }>("/api/editor/recent", "GET").then((d) => d.assets),
  });
}

export interface CollectionView {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
}

export function useCollectionsQuery() {
  return useQuery({
    queryKey: ["editor", "collections"] as const,
    queryFn: () => editorApi<{ collections: CollectionView[] }>("/api/editor/collections", "GET").then((d) => d.collections),
  });
}

export function useCreateCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => editorApi<{ collection: CollectionView }>("/api/editor/collections", "POST", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editor", "collections"] }),
  });
}

export function useDeleteCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collectionId: string) => editorApi(`/api/editor/collections/${collectionId}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editor", "collections"] }),
  });
}

export function useCollectionAssetsQuery(collectionId: string | null) {
  return useQuery({
    queryKey: ["editor", "collections", collectionId, "assets"] as const,
    queryFn: () => editorApi<{ assets: AssetView[] }>(`/api/editor/collections/${collectionId}/assets`, "GET").then((d) => d.assets),
    enabled: !!collectionId,
  });
}

export function useAddAssetToCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, assetId }: { collectionId: string; assetId: string }) =>
      editorApi(`/api/editor/collections/${collectionId}/assets/${assetId}`, "POST"),
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ["editor", "collections", vars.collectionId, "assets"] }),
  });
}

export function useRemoveAssetFromCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, assetId }: { collectionId: string; assetId: string }) =>
      editorApi(`/api/editor/collections/${collectionId}/assets/${assetId}`, "DELETE"),
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ["editor", "collections", vars.collectionId, "assets"] }),
  });
}
