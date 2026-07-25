import type { DragEvent } from "react";
import type { DraggableAssetPayload } from "../types";

// Module 11 — the one place that knows the drag-to-timeline DataTransfer
// contract, shared by every card (AssetGrid/AssetList) and read back by
// timeline-panel.tsx's handleDrop(). Mirrors the exact MIME key
// ("application/json") uploads-section.tsx's AssetThumb already
// established — extending that same contract with an optional
// stockResult/providerId/stockCategory shape rather than inventing a
// second one.
export const DRAG_PAYLOAD_MIME = "application/json";

export function setDragPayload(e: DragEvent, payload: DraggableAssetPayload) {
  e.dataTransfer.setData(DRAG_PAYLOAD_MIME, JSON.stringify(payload));
}

export function readDragPayload(e: DragEvent): DraggableAssetPayload | null {
  const raw = e.dataTransfer.getData(DRAG_PAYLOAD_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraggableAssetPayload;
  } catch {
    return null;
  }
}
