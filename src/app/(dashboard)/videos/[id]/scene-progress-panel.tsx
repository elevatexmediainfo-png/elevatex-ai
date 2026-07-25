"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

interface SceneView {
  id: string;
  order: number;
  status: "PENDING" | "RENDERING" | "COMPLETED" | "FAILED" | "CANCELLED";
  errorMessage: string | null;
}

interface ProgressView {
  percent: number;
  total: number;
  completed: number;
  failed: number;
}

const SCENE_BADGE: Record<SceneView["status"], BadgeVariant> = {
  PENDING: "neutral",
  RENDERING: "warning",
  COMPLETED: "success",
  FAILED: "error",
  CANCELLED: "neutral",
};

// Live scene-by-scene progress, fed by the SSE stream (still DB-polling
// under the hood server-side — see the route's own comment — but pushed to
// the client instead of the client polling). Also surfaces the Pause/
// Resume/Cancel/Re-render-failed controls, since they only make sense while
// this panel is visible (project is mid-render or partially failed).
export function SceneProgressPanel({
  videoProjectId,
  projectStatus,
  onProjectStatusChange,
}: {
  videoProjectId: string;
  projectStatus: string;
  onProjectStatusChange: (status: string) => void;
}) {
  const [scenes, setScenes] = React.useState<SceneView[] | null>(null);
  const [progress, setProgress] = React.useState<ProgressView | null>(null);
  const [actionPending, setActionPending] = React.useState(false);
  const statusRef = React.useRef(onProjectStatusChange);
  statusRef.current = onProjectStatusChange;

  React.useEffect(() => {
    const source = new EventSource(`/api/videos/${videoProjectId}/scenes/stream`);

    source.addEventListener("update", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setScenes(data.scenes);
      setProgress(data.progress);
      if (data.project?.status) statusRef.current(data.project.status);
    });
    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.project?.status) statusRef.current(data.project.status);
      source.close();
    });
    source.onerror = () => source.close();

    return () => source.close();
  }, [videoProjectId]);

  async function callAction(path: string, successMessage: string) {
    setActionPending(true);
    try {
      const res = await fetch(`/api/videos/${videoProjectId}/${path}`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "That action couldn't be completed.");
        return;
      }
      toast.success(successMessage);
      if (json.data?.project?.status) statusRef.current(json.data.project.status);
    } catch {
      toast.error("That action couldn't be completed. Please try again.");
    } finally {
      setActionPending(false);
    }
  }

  if (!scenes || scenes.length === 0) return null;

  return (
    <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label-md text-neutral-900">
          Scenes — {progress?.completed ?? 0}/{progress?.total ?? scenes.length} rendered
        </p>
        <div className="flex gap-2">
          {(projectStatus === "QUEUED" || projectStatus === "RENDERING") && (
            <Button
              variant="outline"
              size="sm"
              disabled={actionPending}
              onClick={() => callAction("pause", "Render paused.")}
            >
              Pause
            </Button>
          )}
          {projectStatus === "PAUSED" && (
            <Button
              variant="primary"
              size="sm"
              disabled={actionPending}
              onClick={() => callAction("resume", "Render resumed.")}
            >
              Resume
            </Button>
          )}
          {(projectStatus === "QUEUED" || projectStatus === "RENDERING" || projectStatus === "PAUSED") && (
            <Button
              variant="destructiveOutline"
              size="sm"
              disabled={actionPending}
              onClick={() => callAction("cancel", "Render cancelled.")}
            >
              Cancel
            </Button>
          )}
          {projectStatus === "FAILED" && (progress?.failed ?? 0) > 0 && (
            <Button
              variant="primary"
              size="sm"
              disabled={actionPending}
              onClick={() => callAction("scenes/rerender-failed", "Re-rendering failed scenes…")}
            >
              Re-render failed scenes
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-brand-navy transition-all"
          style={{ width: `${progress?.percent ?? 0}%` }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {scene.status === "RENDERING" && <Loader2 className="size-3.5 animate-spin text-neutral-400" />}
              <p className="text-body-sm text-neutral-700">Scene {scene.order + 1}</p>
            </div>
            <div className="flex items-center gap-2">
              {scene.status === "FAILED" && scene.errorMessage && (
                <p className="max-w-xs truncate text-body-sm text-error" title={scene.errorMessage}>
                  {scene.errorMessage}
                </p>
              )}
              <Badge variant={SCENE_BADGE[scene.status]} outline size="sm">
                {scene.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
