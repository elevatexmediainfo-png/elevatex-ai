"use client";

import * as React from "react";
import { History, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEditorStoreApi } from "./store";
import { useRestoreVersionMutation, useVersionsQuery } from "./queries";
import { createRestoreVersionCommand, type VersionCommandDeps } from "./commands";

function formatVersionTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Version History (Module 5, Part C) — a Sheet listing EditorProjectVersion
// snapshots (timestamp + optional label, newest first), each with a Restore
// button. Restoring is undo-able: the API call itself (not this component)
// snapshots the current state first and returns its id as
// `preRestoreVersionId`; this component then pushes a
// createRestoreVersionCommand onto the SAME global undo/redo stack every
// other module's commands use (store.tsx's pushCommand — the restore
// already executed via the API call, so this records it without calling
// .execute() again). Ctrl+Z after a restore restores back to the
// pre-restore snapshot; redo restores forward to the target again.
export function VersionHistoryPanel({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const storeApi = useEditorStoreApi();
  const versionsQuery = useVersionsQuery(projectId, { enabled: open });
  const restoreMutation = useRestoreVersionMutation(projectId);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  // Every restore call — the initial click here, or a later undo/redo of
  // it — replaces every track/clip row with a freshly-created one (new
  // ids). Whatever was previously selected no longer exists afterward, so
  // this wrapper clears selection uniformly regardless of which of the
  // three callers triggered it, rather than leaving stale ids in
  // selectedClipIds that silently match nothing.
  const versionDeps: VersionCommandDeps = React.useMemo(
    () => ({
      restoreVersion: async (versionId) => {
        const result = await restoreMutation.mutateAsync(versionId);
        storeApi.getState().clearSelection();
        return result;
      },
    }),
    [restoreMutation, storeApi]
  );

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    try {
      const { preRestoreVersionId } = await versionDeps.restoreVersion(versionId);
      storeApi.getState().pushCommand(createRestoreVersionCommand(versionDeps, versionId, preRestoreVersionId));
      onOpenChange(false);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col bg-surface-0 text-white">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <History className="size-4" />
            Version History
          </SheetTitle>
          <SheetDescription className="text-neutral-400">
            Automatic snapshots of this project. Restoring is undo-able (Ctrl+Z).
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          {versionsQuery.isLoading ? (
            <p className="text-caption text-neutral-500">Loading…</p>
          ) : versionsQuery.data?.length ? (
            versionsQuery.data.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between gap-2 rounded-md border border-editor-line px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-caption text-neutral-200">{version.label ?? "Automatic snapshot"}</p>
                  <p className="text-caption text-neutral-500">{formatVersionTimestamp(version.createdAt)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-neutral-300 hover:text-white"
                  disabled={restoringId !== null}
                  onClick={() => void handleRestore(version.id)}
                >
                  {restoringId === version.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                  Restore
                </Button>
              </div>
            ))
          ) : (
            <p className="text-caption text-neutral-500">
              No versions yet — one is saved automatically as you edit (every few minutes or after a burst of changes).
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
