"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { VideoStatusBadge } from "@/components/shared/video-status-badge";
import { openCheckout, pollPaymentIntentStatus, type CheckoutConfig } from "@/lib/payments/checkout-client";
import { SceneProgressPanel } from "./scene-progress-panel";

interface VideoProjectView {
  id: string;
  title: string;
  status: string;
  generatedScript: string | null;
  previewVideoUrl: string | null;
  previewThumbnailUrl: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  creditCost: number;
  /** GENERATED/FILM downloads are free — real cost is already charged per-scene at generation time (see download-service.ts's requestDownload). Only TALKING_HEAD_UPLOAD still charges creditCost here. */
  sourceType: string;
  templateName: string | null;
  /** True when at least one scene's AI overlay fell back to a mock/placeholder because the real provider chain was exhausted — same situation Quick Video/Film Scene already warn about, previously silent here. */
  hasMockFallbackScenes: boolean;
}

const POLLING_STATUSES = new Set(["QUEUED", "RENDERING", "PAUSED"]);
const SCENE_PANEL_STATUSES = new Set(["QUEUED", "RENDERING", "PAUSED", "FAILED"]);
const POLL_INTERVAL_MS = 3000;

export function VideoDetailClient({ initialProject }: { initialProject: VideoProjectView }) {
  const [project, setProject] = React.useState(initialProject);
  const [downloading, setDownloading] = React.useState(false);
  const [needsPurchase, setNeedsPurchase] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/download`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.code === "ERR_INSUFFICIENT_CREDITS") {
          setNeedsPurchase(true);
        }
        toast.error(json.error?.message ?? "Couldn't start your download.");
        return;
      }
      setNeedsPurchase(false);
      window.open(json.data.url, "_blank");
    } catch {
      toast.error("Couldn't start your download. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  // Buying just this one download (Pay Per Download, no credit package or
  // subscription) — surfaced only after a download attempt comes back
  // ERR_INSUFFICIENT_CREDITS. Same settle pattern as the credits page:
  // mock mode confirms instantly, a real provider opens its widget and we
  // poll the PaymentIntent for the signature-verified webhook to settle it.
  async function handlePurchase() {
    setPurchasing(true);
    try {
      const res = await fetch(`/api/videos/${project.id}/purchase`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't start checkout.");
        return;
      }
      const checkoutConfig = json.data.checkoutConfig as CheckoutConfig;
      const paymentIntentId = json.data.paymentIntentId as string;

      if (checkoutConfig.provider === "mock") {
        const confirmRes = await fetch("/api/billing/mock/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        });
        const confirmJson = await confirmRes.json();
        if (!confirmJson.success) {
          toast.error(confirmJson.error?.message ?? "Couldn't complete the purchase.");
          return;
        }
        toast.success("Purchase complete — you can download now.");
        setNeedsPurchase(false);
        return;
      }

      await openCheckout({
        checkoutConfig,
        onSuccess: async () => {
          const toastId = toast.loading("Confirming your payment…");
          const status = await pollPaymentIntentStatus(paymentIntentId);
          toast.dismiss(toastId);
          if (status === "PAID") {
            toast.success("Purchase complete — you can download now.");
            setNeedsPurchase(false);
          } else if (status === "FAILED" || status === "CANCELLED") {
            toast.error("Payment didn't go through. Please try again.");
          } else {
            toast.info("Still confirming your payment — try downloading again shortly.");
          }
        },
        onDismiss: () => toast.info("Checkout cancelled."),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open checkout.");
    } finally {
      setPurchasing(false);
    }
  }

  const handleProjectStatusChange = React.useCallback((status: string) => {
    setProject((prev) => (prev.status === status ? prev : { ...prev, status }));
  }, []);

  React.useEffect(() => {
    if (!POLLING_STATUSES.has(project.status)) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/videos/${project.id}`);
      const json = await res.json();
      if (json.success) {
        setProject((prev) => ({ ...prev, ...json.data.project }));
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [project.id, project.status]);

  return (
    <div>
      <Link
        href="/videos"
        className="mb-6 inline-flex items-center gap-1.5 text-label-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" /> Back to videos
      </Link>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-heading-1 text-neutral-900">{project.title}</h1>
        <div className="flex items-center gap-3">
          <VideoStatusBadge status={project.status} />
          <Link href={`/videos/${project.id}/editor`}>
            <Button type="button" variant="outline" size="sm">
              <Pencil className="size-4" /> Open Editor
            </Button>
          </Link>
        </div>
      </div>
      {project.templateName && (
        <p className="mt-1 text-body-sm text-neutral-500">{project.templateName}</p>
      )}

      {(project.status === "QUEUED" || project.status === "RENDERING") && (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white py-16 text-center">
          <Loader2 className="size-7 animate-spin text-brand-navy" />
          <p className="text-body-md text-neutral-700">
            {project.status === "QUEUED" ? "Waiting in the render queue…" : "Rendering your video…"}
          </p>
          <p className="text-body-sm text-neutral-500">This usually takes under a minute.</p>
        </div>
      )}

      {SCENE_PANEL_STATUSES.has(project.status) && (
        <SceneProgressPanel
          videoProjectId={project.id}
          projectStatus={project.status}
          onProjectStatusChange={handleProjectStatusChange}
        />
      )}

      {project.status === "COMPLETED" && project.previewVideoUrl && (
        <div className="mt-8 flex flex-col gap-4">
          {/* Free, unlimited, watermarked preview stream — never the master.
              Downloading the clean, full-HD master is a separate, credit- or
              subscription-gated action handled by the Download Service. */}
          <video
            src={project.previewVideoUrl}
            poster={project.previewThumbnailUrl ?? undefined}
            controls
            controlsList="nodownload"
            className="w-full rounded-xl bg-black"
          />
          {project.hasMockFallbackScenes && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-light px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-body-sm text-warning">
                One or more scenes used a placeholder overlay instead of a real AI generation (no credits charged for
                those) — this can happen when no AI provider is currently configured or available.
              </p>
            </div>
          )}
          <Button variant="primary" size="default" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download HD (no watermark)
            {project.sourceType === "TALKING_HEAD_UPLOAD" &&
              ` — ${project.creditCost} credit${project.creditCost === 1 ? "" : "s"}`}
          </Button>

          {needsPurchase && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-body-sm text-neutral-600">
                Not enough credits? Buy just this download instead — no package or subscription needed.
              </p>
              <Button variant="secondary" size="sm" onClick={handlePurchase} disabled={purchasing}>
                {purchasing ? <Loader2 className="size-4 animate-spin" /> : "Buy this download"}
              </Button>
            </div>
          )}
        </div>
      )}

      {project.status === "FAILED" && (
        <div className="mt-8 rounded-xl border border-error/30 bg-error-light p-4">
          <p className="text-label-md text-error">Rendering failed</p>
          <p className="mt-1 text-body-sm text-error">
            {project.errorMessage ?? "Something went wrong while rendering this video."}
          </p>
          <p className="mt-2 text-body-sm text-neutral-600">
            Rendering is free. If only some scenes failed, use &quot;Re-render failed scenes&quot; below instead of
            starting over.
          </p>
        </div>
      )}

      {project.generatedScript && (
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-2 text-label-sm text-neutral-500">Script</p>
          <p className="whitespace-pre-line text-body-sm text-neutral-700">
            {project.generatedScript}
          </p>
        </div>
      )}
    </div>
  );
}
