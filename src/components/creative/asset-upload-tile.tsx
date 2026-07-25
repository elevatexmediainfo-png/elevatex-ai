"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadCloud, X, Loader2, Sparkles } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { putWithProgress } from "@/lib/upload/put-with-progress";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface AssetUploadValue {
  assetId: string;
  previewUrl: string;
}

interface SavedOption {
  assetId: string;
  url: string;
  label: string;
}

export interface RecentReferenceOption {
  assetId: string;
  url: string;
  label: string;
}

interface AssetUploadTileProps {
  label: string;
  helperText?: string;
  value: AssetUploadValue | null;
  onChange: (value: AssetUploadValue | null) => void;
  /** e.g. the user's existing Brand Kit logo — offered as a one-click alternative to uploading a fresh file. */
  savedOption?: SavedOption;
  /** Milestone 16 — the Design Intelligence Library's "Reference Search" step: the user's own previously-analyzed reference uploads, reusable without re-uploading or re-analyzing. */
  recentOptions?: RecentReferenceOption[];
}

// Milestone 15 — reusable upload widget for the Universal Creative
// Workflow's optional Reference Image and Brand Logo inputs. Wraps the
// existing presigned-upload flow (POST /api/assets/upload-url -> direct PUT
// -> POST /api/assets/[id]/confirm-upload), the same 3-step pattern the
// Talking Head uploader already uses — never a second upload mechanism.
export function AssetUploadTile({ label, helperText, value, onChange, savedOption, recentOptions }: AssetUploadTileProps) {
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, kind: "IMAGE", fileSizeBytes: file.size }),
      });
      const urlJson = await urlRes.json();
      if (!urlJson.success) {
        toast.error(urlJson.error?.message ?? "Couldn't start the upload.");
        return;
      }

      await putWithProgress(urlJson.data.uploadUrl, file, setProgress);

      const confirmRes = await fetch(`/api/assets/${urlJson.data.assetId}/confirm-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmJson.success) {
        toast.error(confirmJson.error?.message ?? "Couldn't finish the upload.");
        return;
      }

      onChange({ assetId: urlJson.data.assetId, previewUrl: confirmJson.data.asset.url });
    } catch {
      toast.error("Network error during upload. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (value) {
    return (
      <div>
        <p className="mb-2 text-label-md text-neutral-700">{label}</p>
        <div className="relative w-32 overflow-hidden rounded-lg border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt={label} className="aspect-square w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label={`Remove ${label}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-label-md text-neutral-700">
        {label} <span className="text-neutral-400">(optional)</span>
      </p>
      <label
        className={cn(
          "flex w-32 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-neutral-300 p-4 text-center transition-colors",
          uploading ? "pointer-events-none opacity-60" : "cursor-pointer hover:border-brand-navy/40"
        )}
      >
        <input
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleFile(selected);
          }}
        />
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        ) : (
          <UploadCloud className="size-5 text-neutral-400" />
        )}
        <span className="text-label-sm text-neutral-500">{uploading ? `${progress}%` : "Upload"}</span>
      </label>
      {uploading && <Progress value={progress} className="mt-2 w-32" />}
      {helperText && !uploading && <p className="mt-1.5 max-w-32 text-label-sm text-neutral-400">{helperText}</p>}
      {savedOption && !uploading && (
        <button
          type="button"
          onClick={() => onChange({ assetId: savedOption.assetId, previewUrl: savedOption.url })}
          className="mt-2 flex items-center gap-1 text-label-sm text-brand-navy hover:underline"
        >
          <Sparkles className="size-3.5" /> Use {savedOption.label}
        </button>
      )}
      {recentOptions && recentOptions.length > 0 && !uploading && (
        <div className="mt-3">
          <p className="mb-1.5 text-label-sm text-neutral-500">Recent references</p>
          <div className="flex max-w-[18rem] flex-wrap gap-1.5">
            {recentOptions.map((opt) => (
              <button
                key={opt.assetId}
                type="button"
                onClick={() => onChange({ assetId: opt.assetId, previewUrl: opt.url })}
                className="size-12 overflow-hidden rounded-md border border-neutral-200 transition-colors hover:border-brand-navy/50"
                title={opt.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={opt.url} alt={opt.label} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
