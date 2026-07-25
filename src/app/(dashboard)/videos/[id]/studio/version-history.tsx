"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { SceneView } from "./scene-editor";

interface VersionView {
  id: string;
  createdAt: string;
  createdBy: string | null;
}

interface RestoreResult {
  project: { generatedScript: string | null };
  scenes: SceneView[];
}

// Studio's version history panel — every autosaved snapshot
// (lib/projects/versioning.ts dedupes no-op saves before they're written),
// restorable only pre-render since restore fully replaces scene rows.
export function VersionHistory({
  videoProjectId,
  restorable,
  onRestored,
}: {
  videoProjectId: string;
  restorable: boolean;
  onRestored: (result: RestoreResult) => void;
}) {
  const [versions, setVersions] = React.useState<VersionView[] | null>(null);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/videos/${videoProjectId}/versions`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setVersions(json.data.versions);
      });
  }, [videoProjectId]);

  async function handleRestore(versionId: string) {
    if (!window.confirm("Restore this version? Your current script and scenes will be replaced.")) return;
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/versions/${versionId}/restore`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't restore that version.");
        return;
      }
      onRestored(json.data);
      toast.success("Version restored.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRestoringId(null);
    }
  }

  if (!versions) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (versions.length === 0) {
    return <p className="text-body-md text-neutral-500">No saved versions yet — every edit autosaves one here.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {versions.map((v, i) => (
        <div
          key={v.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2"
        >
          <div>
            <p className="text-body-sm text-neutral-700">
              {i === 0 ? "Latest" : new Date(v.createdAt).toLocaleString()}
            </p>
            {i === 0 && <p className="text-label-sm text-neutral-500">{new Date(v.createdAt).toLocaleString()}</p>}
          </div>
          {restorable && i !== 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={restoringId === v.id}
              onClick={() => handleRestore(v.id)}
            >
              {restoringId === v.id && <Loader2 className="size-3.5 animate-spin" />}
              Restore
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
