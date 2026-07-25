"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/shared/container";
import { SCENE_VISUAL_TYPES } from "@/lib/validations/video";

type VisualType = (typeof SCENE_VISUAL_TYPES)[number];

const VISUAL_TYPE_LABELS: Record<VisualType, string> = {
  FACE_ONLY: "Face only",
  B_ROLL: "B-roll",
  IMAGE: "Image",
  LOGO: "Logo",
  SCREENSHOT: "Screenshot",
  WEBSITE: "Website",
  GRAPH: "Graph",
  CHART: "Chart",
  ICON: "Icon",
  ANIMATION: "Animation",
  TEXT_OVERLAY: "Text overlay",
};

export interface PlanProjectView {
  id: string;
  title: string;
  status: string;
  errorMessage: string | null;
  /** True when the current Transcript row's providerId is MOCK_PROVIDER_ID — see visual-plan-review-client.tsx's warning banner and this app's own incident history for why this can never again be silent. */
  isMockTranscript: boolean;
}

export interface PlanSceneView {
  id: string;
  order: number;
  prompt: string;
  visualType: VisualType | null;
  durationSeconds: number;
  tags: string[];
  isHook: boolean;
  isCTA: boolean;
}

interface CostEstimate {
  scenes: { sceneId: string; decisionKind: string; creditCost: number; vendorCostUsd: number }[];
  totalCreditCost: number;
  totalVendorCostUsd: number;
}

const DECISION_LABELS: Record<string, string> = {
  NONE: "No asset needed",
  REUSE_EXISTING: "Reusing project asset",
  REUSE_BRAND: "Reusing Brand Kit asset",
  REUSE_UPLOADED: "Reusing uploaded asset",
  STOCK: "Stock library",
  AI_IMAGE: "AI image (charged)",
  AI_VIDEO: "AI video (charged)",
};

const POLL_INTERVAL_MS = 4000;

// Milestone 11 — the Talking Head pipeline's counterpart to the GENERATED
// flow's Script Studio review: instead of editing AI-generated script text,
// the user reviews the AI Visual Planner's per-scene visual type + the
// Intelligent Asset Selector's cost preview, with the same "Confirm &
// render" action (POST .../render) the GENERATED flow already uses.
export function VisualPlanReviewClient({
  initialProject,
  initialScenes,
}: {
  initialProject: PlanProjectView;
  initialScenes: PlanSceneView[];
}) {
  const router = useRouter();
  const [project, setProject] = React.useState(initialProject);
  const [scenes, setScenes] = React.useState(initialScenes);
  const [estimate, setEstimate] = React.useState<CostEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [savingSceneId, setSavingSceneId] = React.useState<string | null>(null);
  const [retranscribing, setRetranscribing] = React.useState(false);

  const stillProcessing = project.status === "DRAFT" && scenes.length === 0;

  // 2026-07-13 fix — a real incident: after Re-transcribe finished in the
  // background, the founder had to manually reload to see the fresh
  // transcript. Root cause: useState(initialX) only reads its argument on
  // the FIRST render — router.refresh() below re-fetches this page's server
  // component and passes fresh initialProject/initialScenes props down, but
  // without this sync those new props never reach local state (React does
  // not auto-update state from a changed initial value). The Film flow
  // (film-flow-client.tsx) never hits this class of bug because it reads
  // its project/scenes straight from props with no local useState wrapper
  // at all; this component still needs local state (optimistic visual-type
  // edits, the cost estimate), so the fix here is to explicitly re-sync
  // whenever the server hands down new initial props instead.
  React.useEffect(() => {
    setProject(initialProject);
    setScenes(initialScenes);
  }, [initialProject, initialScenes]);

  const loadEstimate = React.useCallback(async () => {
    setLoadingEstimate(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/cost-estimate`);
      const json = await res.json();
      if (json.success) setEstimate(json.data.estimate);
    } finally {
      setLoadingEstimate(false);
    }
  }, [project.id]);

  // While transcription/analysis run in the background (Parts 2-4, both
  // free), poll for the project to flip out of an empty DRAFT — same
  // polling pattern the video detail page uses for QUEUED/RENDERING.
  React.useEffect(() => {
    if (!stillProcessing) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/videos/${project.id}`);
      const json = await res.json();
      if (!json.success) return;
      setProject((prev) => ({ ...prev, status: json.data.project.status, errorMessage: json.data.project.errorMessage }));
      if (json.data.project.status !== "DRAFT") {
        router.refresh();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [stillProcessing, project.id, router]);

  React.useEffect(() => {
    if (!stillProcessing && scenes.length > 0) loadEstimate();
  }, [stillProcessing, scenes.length, loadEstimate]);

  async function handleVisualTypeChange(sceneId: string, visualType: VisualType) {
    setSavingSceneId(sceneId);
    try {
      const res = await fetch(`/api/videos/${project.id}/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visualType }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't update this scene.");
        return;
      }
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, visualType } : s)));
      loadEstimate();
    } finally {
      setSavingSceneId(null);
    }
  }

  async function handleRetranscribe() {
    if (!window.confirm("Re-transcribe this video? The current scene plan will be discarded and rebuilt from a fresh transcript.")) {
      return;
    }
    setRetranscribing(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/retranscribe`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start re-transcription.");
        return;
      }
      setScenes([]);
      setEstimate(null);
      setProject((prev) => ({ ...prev, status: "DRAFT", errorMessage: null }));
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRetranscribing(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/render`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start rendering.");
        return;
      }
      router.push(`/videos/${project.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (stillProcessing) {
    return (
      <Container className="flex max-w-2xl flex-col items-center justify-center gap-3 py-24 text-center">
        <Loader2 className="size-7 animate-spin text-brand-navy" />
        <p className="text-body-md text-neutral-700">
          Transcribing your video and planning the visuals — this runs in the background and is free.
        </p>
      </Container>
    );
  }

  return (
    <Container className="flex max-w-3xl flex-col py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 text-neutral-900">{project.title}</h1>
          <p className="mt-2 text-body-md text-neutral-500">
            Review how the AI plans to edit your video, then confirm to generate it.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="shrink-0"
          disabled={retranscribing}
          onClick={handleRetranscribe}
        >
          {retranscribing && <Loader2 className="size-4 animate-spin" />}
          Re-transcribe
        </Button>
      </div>

      {project.isMockTranscript && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-body-sm text-warning">
            This is placeholder text — real transcription didn&apos;t run, so nothing below reflects what was actually
            said in your video. Click <span className="font-medium">Re-transcribe</span> above once a real
            transcription provider is enabled and reachable.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {scenes.map((scene) => {
          const sceneEstimate = estimate?.scenes.find((s) => s.sceneId === scene.id);
          return (
            <div key={scene.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-body-md text-neutral-900">{scene.prompt}</p>
                <span className="shrink-0 text-label-sm text-neutral-500">{scene.durationSeconds}s</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {scene.isHook && <Badge variant="info">Hook</Badge>}
                {scene.isCTA && <Badge variant="brand">CTA</Badge>}
                {scene.tags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Select
                  value={scene.visualType ?? "FACE_ONLY"}
                  onValueChange={(v) => handleVisualTypeChange(scene.id, v as VisualType)}
                  disabled={savingSceneId === scene.id}
                >
                  <SelectTrigger className="h-9 w-44" aria-label="Visual type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENE_VISUAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {VISUAL_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {sceneEstimate && (
                  <span className="text-label-sm text-neutral-500">
                    {DECISION_LABELS[sceneEstimate.decisionKind] ?? sceneEstimate.decisionKind}
                    {sceneEstimate.creditCost > 0 && ` — ${sceneEstimate.creditCost} credit${sceneEstimate.creditCost === 1 ? "" : "s"}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <p className="text-label-md text-neutral-700">Estimated cost</p>
          <p className="mt-1 text-heading-2 text-neutral-900">
            {loadingEstimate ? (
              <Loader2 className="size-5 animate-spin text-neutral-400" />
            ) : (
              `${estimate?.totalCreditCost ?? 0} credit${(estimate?.totalCreditCost ?? 0) === 1 ? "" : "s"}`
            )}
          </p>
          <p className="text-label-sm text-neutral-500">
            Reused/stock assets are free — credits are only charged for AI-generated overlays.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={confirming || scenes.length === 0}
          onClick={handleConfirm}
        >
          {confirming && <Loader2 className="size-4 animate-spin" />}
          <Sparkles className="size-4" />
          Confirm & generate
        </Button>
      </div>
    </Container>
  );
}
