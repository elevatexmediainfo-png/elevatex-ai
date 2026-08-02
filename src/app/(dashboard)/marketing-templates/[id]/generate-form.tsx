"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, UploadCloud, Download, Film } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { putWithProgress } from "@/lib/upload/put-with-progress";

interface GenerateResult {
  generationId: string;
  editorAssetId: string;
  resultUrl: string;
  providerId?: string;
}

// Migration v3 (2026-08-02) — the user never sees or edits the Master
// Prompt, and never chooses a provider (it's always admin-locked to the
// template, Primary -> Fallback -> Error, resolved entirely server-side).
// The only input this form collects is the user's own upload — required or
// optional per the template's own userAssetRequired, validated here AND
// server-side (generateFromMarketingTemplate's own MissingUserAssetError).
export function GenerateForm({
  templateId,
  outputType,
  userAssetRequired,
}: {
  templateId: string;
  outputType: "IMAGE" | "VIDEO";
  userAssetRequired: boolean;
}) {
  const router = useRouter();
  const [userAssetId, setUserAssetId] = React.useState<string | null>(null);
  const [userAssetPreviewUrl, setUserAssetPreviewUrl] = React.useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<GenerateResult | null>(null);
  const [openingInEditor, setOpeningInEditor] = React.useState(false);

  async function uploadUserAsset(file: File) {
    setUploadingAsset(true);
    try {
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          kind: outputType === "VIDEO" && file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
          fileSizeBytes: file.size,
        }),
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
      setUserAssetId(urlJson.data.assetId);
      setUserAssetPreviewUrl(URL.createObjectURL(file));
    } catch {
      toast.error("Network error during upload. Please try again.");
    } finally {
      setUploadingAsset(false);
    }
  }

  async function generate() {
    if (userAssetRequired && !userAssetId) {
      toast.error("Please upload your image or video first.");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/marketing-templates/${templateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAssetId: userAssetId ?? undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't generate this.");
        return;
      }
      setResult({
        generationId: json.data.generationId,
        editorAssetId: json.data.editorAssetId,
        resultUrl: json.data.resultUrl,
        providerId: json.data.providerId,
      });
      toast.success("Generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function openInEditor() {
    if (!result) return;
    setOpeningInEditor(true);
    try {
      const res = await fetch(`/api/marketing-templates/generations/${result.generationId}/open-in-editor`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't open this in the editor.");
        return;
      }
      router.push(`/editor/${json.data.projectId}`);
    } finally {
      setOpeningInEditor(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-label-sm text-dash-ink/70">
          Your {outputType === "VIDEO" ? "image or video" : "image"} {userAssetRequired ? "(required)" : "(optional)"}
        </Label>
        <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-edge-card px-3 py-4 text-label-sm text-dash-ink/60 hover:border-edge-hover">
          <input
            type="file"
            accept={outputType === "VIDEO" ? "image/*,video/*" : "image/*"}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadUserAsset(file);
            }}
          />
          {uploadingAsset ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {userAssetPreviewUrl ? "Uploaded ✓ — click to replace" : "Upload"}
        </label>
        {userAssetPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userAssetPreviewUrl} alt="Your upload" className="mt-2 h-16 rounded-lg border border-edge-card object-contain" />
        )}
      </div>

      <Button
        type="button"
        variant="primary"
        size="default"
        disabled={generating || uploadingAsset || (userAssetRequired && !userAssetId)}
        onClick={generate}
      >
        {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Generate — Free
      </Button>

      {result && (
        <div className="mt-2 flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-4">
          <p className="text-label-md text-dash-ink">Your result</p>
          <div className="overflow-hidden rounded-lg border border-edge-card bg-black">
            {outputType === "VIDEO" ? (
              <video src={result.resultUrl} className="w-full" controls />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.resultUrl} alt="Generated result" className="w-full" />
            )}
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={result.resultUrl} download target="_blank" rel="noreferrer">
                <Download className="size-3.5" /> Download
              </a>
            </Button>
            {outputType === "VIDEO" && (
              <Button type="button" variant="outline" size="sm" disabled={openingInEditor} onClick={openInEditor}>
                {openingInEditor ? <Loader2 className="size-3.5 animate-spin" /> : <Film className="size-3.5" />}
                Open in Editor
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
