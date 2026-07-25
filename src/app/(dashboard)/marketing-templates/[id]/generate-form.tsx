"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, UploadCloud, Download, Film } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { putWithProgress } from "@/lib/upload/put-with-progress";
import { useVideoProviders, VideoProviderSelect, fallbackNoticeText } from "@/components/video/video-provider-select";

function humanizeFieldName(name: string): string {
  const withSpaces = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

interface GenerateResult {
  generationId: string;
  editorAssetId: string;
  resultUrl: string;
  providerId?: string;
  requestedProviderId?: string;
}

export function GenerateForm({
  templateId,
  placeholders,
  outputType,
  creditCost,
}: {
  templateId: string;
  placeholders: string[];
  outputType: "IMAGE" | "VIDEO";
  creditCost: number;
}) {
  const router = useRouter();
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>({});
  const [logoAssetId, setLogoAssetId] = React.useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<GenerateResult | null>(null);
  const [openingInEditor, setOpeningInEditor] = React.useState(false);
  // Only VIDEO templates call renderVideo() — the selector is meaningless
  // (and the hook is never fetched) for IMAGE templates.
  const { providers: videoProviders, selected: preferredProviderId, setSelected: setPreferredProviderId } =
    useVideoProviders(outputType === "VIDEO" ? creditCost : 0);

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
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
      setLogoAssetId(urlJson.data.assetId);
      setLogoPreviewUrl(URL.createObjectURL(file));
    } catch {
      toast.error("Network error during upload. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function generate() {
    const missing = placeholders.filter((p) => !fieldValues[p]?.trim());
    if (missing.length > 0) {
      toast.error(`Please fill in: ${missing.map(humanizeFieldName).join(", ")}`);
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/marketing-templates/${templateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filledFields: fieldValues,
          logoAssetId: logoAssetId ?? undefined,
          preferredProviderId: outputType === "VIDEO" ? preferredProviderId : undefined,
        }),
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
        requestedProviderId: outputType === "VIDEO" ? preferredProviderId : undefined,
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
      {placeholders.length === 0 ? (
        <p className="text-body-sm text-dash-ink/55">This template has no fields to fill in — just add your logo below.</p>
      ) : (
        placeholders.map((name) => (
          <div key={name}>
            <Label className="text-label-sm text-dash-ink/70">{humanizeFieldName(name)}</Label>
            <Input
              value={fieldValues[name] ?? ""}
              onChange={(e) => setFieldValues((v) => ({ ...v, [name]: e.target.value }))}
              placeholder={humanizeFieldName(name)}
            />
          </div>
        ))
      )}

      <div>
        <Label className="text-label-sm text-dash-ink/70">Your logo (optional)</Label>
        <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-edge-card px-3 py-4 text-label-sm text-dash-ink/60 hover:border-edge-hover">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
          {uploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {logoPreviewUrl ? "Logo uploaded ✓ — click to replace" : "Upload your logo/image"}
        </label>
        {logoPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPreviewUrl} alt="Your logo" className="mt-2 h-16 rounded-lg border border-edge-card object-contain" />
        )}
      </div>

      {outputType === "VIDEO" && (
        <VideoProviderSelect
          providers={videoProviders}
          value={preferredProviderId}
          onChange={setPreferredProviderId}
          labelClassName="text-dash-ink/70"
        />
      )}

      <Button type="button" variant="primary" size="default" disabled={generating || uploadingLogo} onClick={generate}>
        {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Generate ({creditCost} credit{creditCost === 1 ? "" : "s"})
      </Button>

      {result && (
        <div className="mt-2 flex flex-col gap-3 rounded-card border border-edge-card bg-glass-card p-4">
          <p className="text-label-md text-dash-ink">Your result</p>
          {(() => {
            const notice = fallbackNoticeText(result.requestedProviderId, result.providerId ?? "", videoProviders);
            return notice ? <p className="text-body-sm text-amber-400">{notice}</p> : null;
          })()}
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
