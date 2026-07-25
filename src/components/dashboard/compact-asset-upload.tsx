"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, X, type LucideIcon } from "lucide-react";

import { putWithProgress } from "@/lib/upload/put-with-progress";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface CompactUploadValue {
  assetId: string;
  previewUrl: string;
}

interface CompactAssetUploadProps {
  icon: LucideIcon;
  label: string;
  value: CompactUploadValue | null;
  onChange: (value: CompactUploadValue | null) => void;
}

// Hero prompt box's icon-button reference/logo uploaders — a 3rd thin
// client-side caller of the same presigned-upload sequence AssetUploadTile
// wraps (POST /api/assets/upload-url -> direct PUT -> POST
// /api/assets/[id]/confirm-upload), behind a compact icon-button instead of
// AssetUploadTile's larger drop-zone UI. Same API contract, no new upload
// mechanism — the Talking Head uploader is already a 2nd independent caller
// of this sequence, so a 3rd compact variant is consistent with precedent.
export function CompactAssetUpload({ icon: Icon, label, value, onChange }: CompactAssetUploadProps) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    setUploading(true);
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
      await putWithProgress(urlJson.data.uploadUrl, file, () => {});
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
      <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dash-ink/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.previewUrl} alt={label} className="size-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100"
          aria-label={`Remove ${label}`}
        >
          <X className="size-3.5 text-white" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      title={label}
      disabled={uploading}
      onClick={() => inputRef.current?.click()}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dash-ink/15 bg-dash-ink/10 text-dash-ink/70 transition-colors hover:bg-dash-ink/20 hover:text-dash-ink disabled:opacity-60"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) handleFile(selected);
        }}
      />
      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
    </button>
  );
}
