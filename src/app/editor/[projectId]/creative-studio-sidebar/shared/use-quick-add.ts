"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";

import { useAddClipMutation, useEditorProjectQuery, useMaterializeStockAssetMutation } from "../../queries";
import { useEditorStore } from "../../store";
import type { DraggableAssetPayload } from "../types";

const DEFAULT_DURATION_MS = 3000;

function isVideoLikeKind(kind: string | undefined): boolean {
  return kind === "VIDEO" || kind === "IMAGE" || kind === "ANIMATION";
}

// Module 11 — the click-to-add "+" button's logic, shared by every real
// section (library tabs, favorites, recent, stock search). Reads
// `projectId` via useParams() rather than a prop, matching this file's
// sibling sections (queries.ts's own header comment: "every panel that
// needs tracks/clips/assets calls these directly rather than threading
// them through props" — same reasoning extended to projectId itself, so
// SidebarSectionDef's zero-props Component contract never needs widening).
export function useQuickAddToTimeline() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data } = useEditorProjectQuery(projectId);
  const tracks = data?.tracks ?? [];
  const playheadMs = useEditorStore((s) => s.playheadMs);
  const addClipMutation = useAddClipMutation(projectId);
  const materializeMutation = useMaterializeStockAssetMutation();

  function pickTargetTrack(kind: string | undefined) {
    const wantVideo = isVideoLikeKind(kind);
    return tracks.find((t) => !t.isLocked && (wantVideo ? t.kind === "VIDEO" : t.kind === "AUDIO"));
  }

  async function addAsset(payload: DraggableAssetPayload, label: string) {
    let assetId = payload.assetId;
    let kind = payload.kind;
    let durationMs = payload.durationMs ?? DEFAULT_DURATION_MS;

    if (!assetId && payload.stockResult) {
      const toastId = toast.loading(`Adding ${label}…`);
      try {
        const { asset } = await materializeMutation.mutateAsync({
          providerId: payload.providerId!,
          category: payload.stockCategory!,
          result: payload.stockResult,
        });
        assetId = asset.id;
        kind = asset.kind;
        durationMs = payload.stockResult.durationSeconds ? Math.round(payload.stockResult.durationSeconds * 1000) : DEFAULT_DURATION_MS;
        toast.success(`Added ${label}`, { id: toastId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add this item.", { id: toastId });
        return;
      }
    }

    if (!assetId) return;

    const track = pickTargetTrack(kind);
    if (!track) {
      toast.error(`Add a ${isVideoLikeKind(kind) ? "Video" : "Audio"} track first.`);
      return;
    }

    addClipMutation.mutate({ trackId: track.id, assetId, startMs: playheadMs, durationMs });
  }

  return { addAsset };
}
