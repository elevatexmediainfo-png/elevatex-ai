"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AudioLines, Film, Heart, ImageIcon, Loader2, Sparkles, Trash2, TriangleAlert, Type, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  useDeleteEditorAssetMutation,
  useEditorAssetsQuery,
  useEditorProjectQuery,
  useFavoritesQuery,
  useInstantAddVideoClip,
  useToggleFavoriteMutation,
  useUploadEditorAssetMutation,
} from "../../queries";
import type { AssetView, EditorAssetKind } from "../../../types";
import { PanelHeader } from "../shared/panel-header";
import { EmptyState } from "../shared/empty-state";
import { MotionCard } from "../../motion-primitives";

// Uploads — the one section already wired to a real API (the presigned-URL
// upload flow built in Module 1). Every other Creative Studio section is
// placeholder UI only, per the brief; this one keeps its existing, working
// functionality rather than regressing it back to a mock.
const ASSET_ICON: Record<EditorAssetKind, React.ComponentType<{ className?: string }>> = {
  VIDEO: Film,
  AUDIO: AudioLines,
  IMAGE: ImageIcon,
  // FONT assets are uploaded from the Brand Kit sidebar slot, not here —
  // this map just needs to stay exhaustive over EditorAssetKind.
  FONT: Type,
  // Milestone 26 — ANIMATION (Lottie) assets only ever come from the Admin
  // Asset Library, never a user upload here, but this map must stay
  // exhaustive over the full EditorAssetKind since AssetView can now
  // legitimately carry one (e.g. if a project embeds one via a future
  // library-browse flow).
  ANIMATION: Sparkles,
};

// Fix (2026-07-12) — a card with no real thumbnail used to fall back to a
// generic grey box + the same film-strip/clapperboard icon for every VIDEO
// card (identical across all of them, no way to tell them apart at a
// glance) — not the agreed "solid color block keyed by type" fallback.
// Reuses the exact same --color-track-* tokens the Timeline's own clips
// already use (globals.css's @theme block), so a video card and a video
// clip read as the same "kind of thing" at a glance. IMAGE isn't listed —
// it always renders a real inline <img> instead (the browser can decode it
// directly), so it never needs a fallback color; FONT maps to the same
// track-text color font clips would use, ANIMATION to track-overlay
// (animations are decorative/overlay content), matching the closest real
// Timeline-track concept for kinds that have no track of their own.
const ASSET_FALLBACK_COLOR: Partial<Record<EditorAssetKind, string>> = {
  VIDEO: "bg-track-video",
  AUDIO: "bg-track-audio",
  FONT: "bg-track-text",
  ANIMATION: "bg-track-overlay",
};

export function UploadsSection() {
  // Fix (2026-07-12) — reads projectId via useParams() rather than a prop,
  // matching use-quick-add.ts's own established reasoning: SidebarSectionDef's
  // Component contract is zero-props by design, so every section that needs
  // projectId reads it directly rather than widening that contract.
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [search, setSearch] = React.useState("");
  // Kind filter chips (2026-07-14, full-spec audit pass) — real client-side
  // filtering over asset.kind, the same real field ASSET_ICON/
  // ASSET_FALLBACK_COLOR above already key off; a genuine "All" chip needs
  // real alternatives to switch between, so this adds Video/Audio/Image too
  // rather than a single always-active chip that would do nothing (that
  // would have been the fake-UI the brief warns against, not the filter
  // itself).
  const [kindFilter, setKindFilter] = React.useState<"ALL" | "VIDEO" | "AUDIO" | "IMAGE">("ALL");
  const assetsQuery = useEditorAssetsQuery(undefined, projectId);
  const upload = useUploadEditorAssetMutation(projectId);
  const instantAddVideoClip = useInstantAddVideoClip(projectId);
  const remove = useDeleteEditorAssetMutation();
  // "Added" badge (2026-07-14) — real data, not decorative: cross-references
  // this project's actual clips (the same ProjectWorkspaceData query the
  // rest of the editor already fetches, deduped via TanStack Query's cache,
  // not a second/duplicate fetch) against each asset's id.
  const projectQuery = useEditorProjectQuery(projectId);
  const usedAssetIds = React.useMemo(
    () => new Set((projectQuery.data?.clips ?? []).map((c) => c.assetId).filter((id): id is string => !!id)),
    [projectQuery.data?.clips]
  );
  // Module 11 — a materialized stock-search result lands here as a normal
  // USER-scope asset (see search-service.ts's materializeStockAsset()), so
  // this is also the natural place to favorite/unfavorite it, not just
  // already-favorited items shown in the Favorites tab.
  const favoritesQuery = useFavoritesQuery();
  const toggleFavorite = useToggleFavoriteMutation();
  const favoritedIds = new Set((favoritesQuery.data ?? []).map((a) => a.id));
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  // Real, accurate per-file progress (2026-07-21) — keyed by a per-upload
  // id rather than filename, since multiple files (or the same filename
  // twice) can genuinely be in flight at once via the multi-select file
  // input below. Cleared on settle (success or failure) either way — a
  // failed upload shouldn't leave a stuck progress row.
  const [inFlightUploads, setInFlightUploads] = React.useState<
    Map<string, { name: string; loadedBytes: number; totalBytes: number }>
  >(new Map());

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const kind: EditorAssetKind = file.type.startsWith("video/")
        ? "VIDEO"
        : file.type.startsWith("audio/")
          ? "AUDIO"
          : "IMAGE";
      const uploadId = crypto.randomUUID();
      setInFlightUploads((prev) => new Map(prev).set(uploadId, { name: file.name, loadedBytes: 0, totalBytes: file.size }));
      const onProgress = (loadedBytes: number, totalBytes: number) => {
        setInFlightUploads((prev) => new Map(prev).set(uploadId, { name: file.name, loadedBytes, totalBytes }));
      };
      const onSettled = () => {
        setInFlightUploads((prev) => {
          const next = new Map(prev);
          next.delete(uploadId);
          return next;
        });
      };

      // Local-instant-preview (2026-07-24) — VIDEO files (manual-editing's
      // main use case, and the slowest to upload) skip the wait: a real
      // clip lands on the timeline immediately against a local blob preview
      // while the real upload runs in the background. AUDIO/IMAGE stay on
      // the existing atomic upload-then-library flow — they're not placed
      // on the timeline automatically either way, and are typically small/
      // fast enough that the wait was never the complaint.
      if (kind === "VIDEO") {
        instantAddVideoClip(file, onProgress).then(onSettled, onSettled);
      } else {
        upload.mutate({ file, kind, onProgress }, { onSettled });
      }
    }
  }

  const allAssets = assetsQuery.data ?? [];
  const assets = allAssets
    .filter((a) => kindFilter === "ALL" || a.kind === kindFilter)
    .filter((a) => !search.trim() || a.originalFilename.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Uploads" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search your uploads…" />
      <div className="flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable]">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {/* Restyled (2026-07-14, CapCut reference pass) — from a full-width
            gradient bar to a compact left-aligned pill (~85px wide,
            matching the reference's "Import" button proportions), same
            real upload flow underneath. Labeled "Import" per the
            reference's own wording — the button's real behavior (open a
            file picker, upload) is exactly what "Import" describes. The
            reference also shows a second "Record" button beside it, which
            is NOT added here: this app has no real recording feature
            anywhere (confirmed via grep across the codebase in an earlier
            pass), and the no-fake-UI principle established this session
            rules out adding a dead button for it. */}
        {/* Kind-filter chip row (2026-07-14) — real filtering, not a
            decorative single "All" chip; see kindFilter state above.
            h-6 (24px) -> h-7 (28px), text-nano (10px) -> text-micro (11px)
            (2026-07-15, left-panel density pass) — matches the spec's own
            "~28px height, ~11-12px text" more precisely. */}
        <div className="mb-2 flex items-center gap-1.5">
          {(["ALL", "VIDEO", "AUDIO", "IMAGE"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={cn(
                "h-7 shrink-0 rounded-full px-2.5 text-micro font-medium transition-colors",
                kindFilter === kind ? "bg-editor-accent/20 text-editor-accent" : "bg-editor-surface-1 text-neutral-400 hover:text-white"
              )}
            >
              {kind === "ALL" ? "All" : kind.charAt(0) + kind.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="editorPrimary"
          size="none"
          disabled={upload.isPending}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 gap-1.5 rounded-md px-3 text-editor-caption"
        >
          {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Import
        </Button>

        {inFlightUploads.size > 0 && (
          <div className="mt-2 space-y-1.5">
            {Array.from(inFlightUploads.entries()).map(([id, { name, loadedBytes, totalBytes }]) => {
              const pct = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
              return (
                <div key={id} className="rounded-md bg-editor-surface-1 px-2 py-1.5">
                  <div className="mb-1 flex items-center justify-between gap-2 text-micro text-neutral-300">
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 tabular-nums text-neutral-400">
                      {formatBytes(loadedBytes)} / {formatBytes(totalBytes)} · {pct}%
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-editor-line">
                    <div className="h-full rounded-full bg-editor-accent transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {assets.length === 0 ? (
          !upload.isPending &&
          inFlightUploads.size === 0 && (
            <EmptyState
              icon={Upload}
              title="No uploads yet"
              description="Upload video, audio, or image files to use in your timeline."
            />
          )
        ) : (
          // gap-3 (12px) -> gap-2 (8px), mt-3 -> mt-2 (2026-07-15,
          // left-panel density pass) — tighter grid spacing, matching the
          // spec's "generally tighten padding/margins between elements"
          // ask; card size itself (aspect-[3/2], set in AssetThumb below)
          // is unchanged, already compact.
          // grid-cols-3 (fixed) -> auto-fill/minmax (2026-07-15, resizable
          // panels) — now that the Left Panel's own width is user-
          // adjustable, a hardcoded 3 columns would either crowd (panel
          // narrowed) or waste space (panel widened); this reflows to
          // however many ~80px-minimum columns actually fit, dropping to
          // 2 or 1 as the panel shrinks, same as the reference asked for.
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
            {assets.map((asset) => (
              <AssetThumb
                key={asset.id}
                asset={asset}
                onDelete={() => remove.mutate(asset.id)}
                isFavorited={favoritedIds.has(asset.id)}
                onToggleFavorite={() => toggleFavorite.mutate(asset.id)}
                isAdded={usedAssetIds.has(asset.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetThumb({
  asset,
  onDelete,
  isFavorited,
  onToggleFavorite,
  isAdded,
}: {
  asset: AssetView;
  onDelete: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  isAdded: boolean;
}) {
  const Icon = ASSET_ICON[asset.kind];

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        assetId: asset.id,
        kind: asset.kind,
        durationMs: asset.durationSeconds ? Math.round(asset.durationSeconds * 1000) : 3000,
      })
    );
  }

  // Parity fix (2026-07-12 visual-fidelity pass) — every other grid card in
  // this sidebar (AssetGrid's cards, stock search results) shows a duration
  // badge; this one never did, purely because nobody had wired it in yet.
  // Same "Xs" convention stock-search-list-section.tsx already uses.
  const durationLabel = asset.durationSeconds ? `${Math.round(asset.durationSeconds)}s` : null;

  return (
    <MotionCard
      draggable={asset.status === "READY"}
      onDragStart={handleDragStart}
      className="overflow-hidden rounded-editor-card border border-editor-line bg-editor-surface-1 shadow-editor-card transition-colors duration-200 hover:border-editor-border-hover"
      title={
        asset.status === "FAILED"
          ? `${asset.originalFilename} — upload failed. Delete and try uploading again.`
          : asset.originalFilename
      }
    >
      {/* aspect-square -> aspect-[3/2] (2026-07-14, CapCut reference pass)
          — the reference's own uploads grid uses landscape ~150x100
          thumbnails, not square ones; unlike AssetGrid.tsx (shared by
          Icons/Stickers/Shapes/Templates, which ARE naturally
          square-ish), this section's content is exclusively
          video/audio/image uploads, so landscape reads correctly here. */}
      <div className={cn("relative flex aspect-[3/2] items-center justify-center", asset.kind === "IMAGE" ? "bg-black/30" : (ASSET_FALLBACK_COLOR[asset.kind] ?? "bg-black/30"))}>
        {asset.status === "PENDING_UPLOAD" || asset.status === "QUEUED_FOR_NORMALIZATION" || asset.status === "NORMALIZING" ? (
          <Loader2 className="size-5 animate-spin text-white/80" />
        ) : asset.status === "FAILED" ? (
          <TriangleAlert className="size-5 text-editor-danger" />
        ) : asset.kind === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.originalFilename} className="h-full w-full object-cover" />
        ) : (
          <Icon className="size-6 text-white/80" />
        )}
        {durationLabel && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-nano leading-none text-white">{durationLabel}</span>
        )}
        {/* "Added" badge (2026-07-14) — real: isAdded is derived from this
            project's actual clips (see usedAssetIds above), not a fake
            always-on decoration. Top-left, matching the reference; Heart
            moved to bottom-left below to avoid overlapping it (both can be
            true for the same card — favorited AND already on the
            timeline). */}
        {isAdded && (
          <span className="absolute top-1 left-1 rounded bg-editor-accent px-1.5 py-0.5 text-nano leading-none font-medium text-white">
            Added
          </span>
        )}
        {asset.status === "FAILED" && (
          <span className="absolute top-1 left-1 rounded bg-editor-danger px-1.5 py-0.5 text-nano leading-none font-medium text-white">
            Failed
          </span>
        )}
        {/* Heart moved inside this same positioning context as the "Added"
            badge and duration label (was a MotionCard-level sibling before,
            using top-1/left-1 relative to the WHOLE card including the
            filename row below — imprecise once "Added" needed that same
            top-left corner). Bottom-left now, opposite the duration badge. */}
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "absolute bottom-1 left-1 rounded bg-black/60 p-1 text-neutral-300",
            isFavorited ? "block" : "hidden group-hover:block"
          )}
          title={isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("size-3", isFavorited && "fill-current text-editor-danger")} />
        </button>
      </div>
      <p className={cn("truncate px-1.5 py-1 text-micro", asset.status === "FAILED" ? "text-editor-danger" : "text-neutral-300")}>
        {asset.originalFilename}
      </p>
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-1 right-1 hidden rounded bg-black/60 p-1 text-neutral-300 hover:text-editor-danger group-hover:block"
        title="Delete"
      >
        <Trash2 className="size-3" />
      </button>
    </MotionCard>
  );
}
