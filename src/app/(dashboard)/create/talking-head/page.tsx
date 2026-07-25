"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { VIDEO_OBJECTIVES, VISIBLE_OBJECTIVES, VIDEO_PLATFORMS, ASPECT_RATIOS } from "@/lib/validations/video";
import { putWithProgress } from "@/lib/upload/put-with-progress";

const OBJECTIVE_LABELS: Record<(typeof VIDEO_OBJECTIVES)[number], string> = {
  PROMOTION: "Promotion",
  NEW_LAUNCH: "New Launch",
  FESTIVAL_GREETING: "Festival Greeting",
  TESTIMONIAL: "Testimonial",
  ANNOUNCEMENT: "Announcement",
  OFFER_DISCOUNT: "Offer / Discount",
  BRAND_AWARENESS: "Brand Awareness",
};

const PLATFORM_LABELS: Record<(typeof VIDEO_PLATFORMS)[number], string> = {
  INSTAGRAM_REEL: "Instagram Reel",
  INSTAGRAM_POST: "Instagram Post",
  FACEBOOK: "Facebook",
  YOUTUBE_SHORTS: "YouTube Shorts",
  WHATSAPP_STATUS: "WhatsApp Status",
  GOOGLE_BUSINESS: "Google Business",
};

const ASPECT_RATIO_LABELS: Record<(typeof ASPECT_RATIOS)[number], string> = {
  RATIO_9_16: "9:16 (Vertical)",
  RATIO_1_1: "1:1 (Square)",
  RATIO_16_9: "16:9 (Widescreen)",
};

const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const STEPS = ["Upload", "Details"] as const;

function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : undefined;
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };
    video.onerror = () => resolve(undefined);
    video.src = URL.createObjectURL(file);
  });
}

// Milestone 11 Part 1 — Talking Head Upload. Step 1 uploads the file
// directly to storage via the Phase A presigned-URL flow (bypassing the
// Next.js server entirely, since these clips can be multiple GB); step 2
// collects the same project metadata POST /api/videos already collects for
// the GENERATED flow, then creates the project via POST /api/videos/talking-head.
export default function TalkingHeadUploadPage() {
  const router = useRouter();

  const [step, setStep] = React.useState(0);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [assetId, setAssetId] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [objective, setObjective] = React.useState<(typeof VIDEO_OBJECTIVES)[number]>("PROMOTION");
  const [platform, setPlatform] = React.useState<(typeof VIDEO_PLATFORMS)[number]>("INSTAGRAM_REEL");
  const [aspectRatio, setAspectRatio] = React.useState<(typeof ASPECT_RATIOS)[number]>("RATIO_9_16");
  const [contentLanguage, setContentLanguage] = React.useState<"EN" | "HI" | "HINGLISH">("EN");
  const [creating, setCreating] = React.useState(false);

  async function handleFileSelected(selected: File) {
    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error("Please choose an MP4, MOV, or WebM video.");
      return;
    }
    setFile(selected);
    setUploading(true);
    setUploadProgress(0);
    try {
      const durationSeconds = await readVideoDuration(selected);

      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selected.name,
          contentType: selected.type,
          kind: "VIDEO",
          fileSizeBytes: selected.size,
        }),
      });
      const urlJson = await urlRes.json();
      if (!urlJson.success) {
        toast.error(urlJson.error?.message ?? "Couldn't start the upload.");
        return;
      }

      await putWithProgress(urlJson.data.uploadUrl, selected, setUploadProgress);

      const confirmRes = await fetch(`/api/assets/${urlJson.data.assetId}/confirm-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmJson.success) {
        toast.error(confirmJson.error?.message ?? "Couldn't finish the upload.");
        return;
      }

      setAssetId(urlJson.data.assetId);
      if (!title.trim()) setTitle(selected.name.replace(/\.[^/.]+$/, ""));
      setStep(1);
    } catch {
      toast.error("Network error during upload. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateProject() {
    if (!assetId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/videos/talking-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAssetId: assetId,
          title: title.trim() || "Untitled video",
          objective,
          platform,
          aspectRatio,
          contentLanguage,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create the project.");
        return;
      }
      router.push(`/videos/${json.data.project.id}/studio`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Container className="flex max-w-2xl flex-col py-10">
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-accent-orange" : "bg-neutral-200")} />
            <span className="text-label-sm text-neutral-500">{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div>
          <h1 className="text-heading-1 text-neutral-900">Upload your video</h1>
          <p className="mt-2 text-body-md text-neutral-500">
            Already have a talking-head video? Upload it and the AI will transcribe it, plan B-roll/captions/overlays, and
            turn it into a marketing video — for free, until you confirm.
          </p>

          <label
            className={cn(
              "mt-8 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 p-12 text-center transition-colors",
              uploading ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-brand-navy/40"
            )}
          >
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleFileSelected(selected);
              }}
            />
            <UploadCloud className="size-8 text-neutral-400" />
            <p className="text-body-md text-neutral-700">
              {file ? file.name : "Click to choose a video (MP4, MOV, or WebM)"}
            </p>
            <p className="text-label-sm text-neutral-500">5–30+ minutes supported.</p>
          </label>

          {uploading && (
            <div className="mt-6 flex flex-col gap-2">
              <Progress value={uploadProgress} />
              <p className="text-center text-label-sm text-neutral-500">Uploading… {uploadProgress}%</p>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <h1 className="text-heading-1 text-neutral-900">Tell us about this video</h1>
          <p className="mt-2 text-body-md text-neutral-500">
            Used to plan the hook, CTA, and which platform to optimize for.
          </p>

          <div className="mt-8 flex flex-col gap-5">
            <div>
              <label className="mb-1.5 block text-label-md text-neutral-700">Video title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-body-md" />
            </div>

            <div>
              <label id="th-objective-label" className="mb-1.5 block text-label-md text-neutral-700">
                Objective
              </label>
              <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
                <SelectTrigger className="h-11 w-full" aria-label="Objective" aria-labelledby="th-objective-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBLE_OBJECTIVES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OBJECTIVE_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label id="th-platform-label" className="mb-1.5 block text-label-md text-neutral-700">
                Platform
              </label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger className="h-11 w-full" aria-label="Platform" aria-labelledby="th-platform-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLATFORM_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label id="th-aspect-label" className="mb-1.5 block text-label-md text-neutral-700">
                Aspect ratio
              </label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}>
                <SelectTrigger className="h-11 w-full" aria-label="Aspect ratio" aria-labelledby="th-aspect-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {ASPECT_RATIO_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-label-md text-neutral-700">Spoken language</p>
              <div className="inline-flex rounded-full border border-neutral-300 p-1">
                {(["EN", "HI", "HINGLISH"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setContentLanguage(lang)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-label-sm",
                      contentLanguage === lang ? "bg-brand-navy text-white" : "text-neutral-500"
                    )}
                  >
                    {lang === "EN" ? "English" : lang === "HI" ? "हिंदी" : "Hinglish"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={!title.trim() || creating}
              onClick={handleCreateProject}
            >
              {creating && <Loader2 className="size-4 animate-spin" />}
              <Sparkles className="size-4" />
              Analyze video
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
