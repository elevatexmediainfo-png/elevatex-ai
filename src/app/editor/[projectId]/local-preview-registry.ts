import * as React from "react";

// Local-instant-preview (2026-07-24) — while a real EditorAsset is still
// PENDING_UPLOAD/QUEUED_FOR_NORMALIZATION/NORMALIZING, the timeline may
// already have a real, persisted clip pointing at it (see
// useInstantAddVideoClip in queries.ts). Its server-side `url` either
// doesn't exist yet or points at a still-transcoding object, so playback
// needs a local `URL.createObjectURL(file)` substitute instead. This module
// is that substitution table: a plain external store (not React state) so
// it can be written from a one-shot async flow and read reactively from
// preview-window.tsx's assetById construction via useSyncExternalStore.
interface LocalPreviewEntry {
  blobUrl: string;
  durationSeconds?: number;
  widthPx?: number;
  heightPx?: number;
}

const registry = new Map<string, LocalPreviewEntry>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  for (const listener of listeners) listener();
}

export function registerLocalPreview(assetId: string, entry: LocalPreviewEntry) {
  registry.set(assetId, entry);
  notify();
}

// Idempotent — safe to call from multiple places (READY-transition cleanup,
// unmount, a failed upload) without needing to track who already cleared it.
export function clearLocalPreview(assetId: string) {
  const entry = registry.get(assetId);
  if (!entry) return;
  URL.revokeObjectURL(entry.blobUrl);
  registry.delete(assetId);
  notify();
}

export function getLocalPreview(assetId: string): LocalPreviewEntry | undefined {
  return registry.get(assetId);
}

export function useLocalPreviewVersion(): number {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => version,
    () => version
  );
}
