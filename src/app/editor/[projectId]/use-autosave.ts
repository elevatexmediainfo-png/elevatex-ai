"use client";

import * as React from "react";

import { editorApi } from "../api-client";
import { useEditorStoreApi } from "./store";
import { useCreateVersionMutation } from "./queries";

// Module 5, Part B/C — every Command already persists to the database
// immediately (see commands.ts's header + store.tsx's runCommand); there is
// no per-keystroke/per-drag-tick write left to debounce. This hook is the
// two things that ARE genuinely new:
//
//  1. A periodic heartbeat (EDITOR_AUTOSAVE_INTERVAL_MS, default 10s) — a
//     no-op PATCH (empty body, valid per updateProjectSchema) that just
//     bumps EditorProject.updatedAt. Its real purpose is keeping the
//     top-bar's save-status indicator honest during idle stretches: if the
//     network/session died while the user wasn't actively editing, THIS is
//     what notices and flips the indicator to "Save failed" instead of it
//     silently staying on a stale "Saved HH:MM:SS" from minutes ago.
//  2. A version snapshot (EDITOR_VERSION_SNAPSHOT_INTERVAL_MS, default 5
//     min, OR every EDITOR_VERSION_SNAPSHOT_COMMAND_INTERVAL undo-stack
//     entries, whichever comes first) — the actual restorable "safety net"
//     Part B's brief describes, deliberately on a much coarser cadence
//     than the heartbeat so an active editing session doesn't flood the
//     version table (createVersionSnapshot also dedupes no-op ticks).
export function useAutosave(
  projectId: string,
  options: { autosaveIntervalMs: number; versionSnapshotIntervalMs: number; versionSnapshotCommandInterval: number }
) {
  const storeApi = useEditorStoreApi();
  const createVersionMutation = useCreateVersionMutation(projectId);
  const commandsAtLastSnapshotRef = React.useRef(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      editorApi(`/api/editor/projects/${projectId}`, "PATCH", {})
        .then(() => storeApi.setState({ saveStatus: "saved", lastSavedAt: Date.now(), lastSaveError: null }))
        .catch((err: unknown) =>
          storeApi.setState({ saveStatus: "error", lastSaveError: err instanceof Error ? err.message : "Save failed." })
        );
    }, options.autosaveIntervalMs);
    return () => clearInterval(id);
  }, [projectId, options.autosaveIntervalMs, storeApi]);

  React.useEffect(() => {
    function snapshotNow() {
      commandsAtLastSnapshotRef.current = storeApi.getState().undoStack.length;
      void createVersionMutation.mutateAsync(undefined);
    }

    // Command-count trigger — fires as soon as N new undo-stack entries
    // land, independent of the time-based interval below.
    const unsubscribe = storeApi.subscribe(
      (s) => s.undoStack.length,
      (length) => {
        if (length - commandsAtLastSnapshotRef.current >= options.versionSnapshotCommandInterval) snapshotNow();
      }
    );

    // Time-based trigger — fires on its own interval regardless of command
    // activity (createVersionSnapshot's dedupe makes an idle tick a cheap
    // no-op insert-skip rather than a wasted row).
    const intervalId = setInterval(snapshotNow, options.versionSnapshotIntervalMs);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [storeApi, options.versionSnapshotIntervalMs, options.versionSnapshotCommandInterval, createVersionMutation]);
}
