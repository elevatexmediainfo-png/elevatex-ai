"use client";

import * as React from "react";
import { toast } from "sonner";
import { AudioLines, FileArchive, Film, ImageIcon, Loader2, Search, Sparkles, Trash2, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIBRARY_ASSET_CATEGORIES, type LibraryAssetCategory } from "@/lib/validations/asset-library";

// Module 11 — CATEGORY_LABELS stays local (display copy, not shared
// business logic), but the category list itself now imports from the
// shared validations file instead of duplicating it — this file used to
// hand-maintain its own copy of LIBRARY_ASSET_CATEGORIES, which silently
// drifted out of sync the moment Module 11 added 6 new categories there.
const CATEGORY_LABELS: Record<LibraryAssetCategory, string> = {
  VIDEO: "Video",
  IMAGE: "Image",
  AUDIO: "Audio",
  SFX: "Sound effect",
  MUSIC: "Music",
  ANIMATION: "Animation (Lottie)",
  STATIC_ICON: "Static icon",
  ANIMATED_ICON: "Animated icon",
  TEMPLATE: "Template",
  TRANSITION: "Transition",
  EFFECT: "Effect",
  SHAPE: "Shape",
  STICKER: "Sticker",
  LOGO: "Logo",
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  VIDEO: Film,
  AUDIO: ImageIcon, // placeholder, overridden below for AUDIO specifically
  IMAGE: ImageIcon,
  ANIMATION: Sparkles,
};

interface LibraryAssetView {
  id: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "ANIMATION";
  category: LibraryAssetCategory;
  status: "PENDING_UPLOAD" | "READY" | "FAILED";
  url: string;
  thumbnailUrl: string | null;
  originalFilename: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  waveformPeaks: number[] | null;
  createdAt: string;
}

function KindIcon({ kind, className }: { kind: LibraryAssetView["kind"]; className?: string }) {
  if (kind === "AUDIO") return <AudioLines className={className} />;
  const Icon = KIND_ICON[kind] ?? ImageIcon;
  return <Icon className={className} />;
}

export function AssetLibraryManager() {
  const [assets, setAssets] = React.useState<LibraryAssetView[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<LibraryAssetCategory | "ALL">("ALL");
  const [batchCategory, setBatchCategory] = React.useState<LibraryAssetCategory>("VIDEO");
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback((q: string, category: LibraryAssetCategory | "ALL") => {
    setAssets(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category !== "ALL") params.set("category", category);
    fetch(`/api/admin/asset-library?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setAssets(json.data.assets);
      });
  }, []);

  React.useEffect(() => {
    const handle = setTimeout(() => load(search, categoryFilter), 250);
    return () => clearTimeout(handle);
  }, [search, categoryFilter, load]);

  async function uploadFiles(files: FileList) {
    setUploading(true);
    const form = new FormData();
    form.append("category", batchCategory);
    for (const file of Array.from(files)) form.append("files", file);
    try {
      const res = await fetch("/api/admin/asset-library/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Upload failed.");
        return;
      }
      const { created, failed } = json.data as { created: unknown[]; failed: { filename: string; error: string }[] };
      if (created.length > 0) toast.success(`Uploaded ${created.length} asset${created.length === 1 ? "" : "s"}.`);
      for (const f of failed) toast.error(`${f.filename}: ${f.error}`);
      load(search, categoryFilter);
    } catch {
      toast.error("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadZip(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("category", batchCategory);
    form.append("zip", file);
    try {
      const res = await fetch("/api/admin/asset-library/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Zip upload failed.");
        return;
      }
      const { created, failed } = json.data as { created: unknown[]; failed: { filename: string; error: string }[] };
      if (created.length > 0) toast.success(`Uploaded ${created.length} asset${created.length === 1 ? "" : "s"} from archive.`);
      for (const f of failed) toast.error(`${f.filename}: ${f.error}`);
      load(search, categoryFilter);
    } catch {
      toast.error("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteAsset(asset: LibraryAssetView) {
    setAssets((prev) => prev?.filter((a) => a.id !== asset.id) ?? null);
    const res = await fetch(`/api/admin/asset-library/${asset.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't delete this asset.");
      load(search, categoryFilter);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-label-sm text-neutral-600">Category (applied to this batch)</label>
            <Select value={batchCategory} onValueChange={(v) => setBatchCategory(v as LibraryAssetCategory)}>
              <SelectTrigger className="h-10 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIBRARY_ASSET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="primary" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            Upload files
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => zipInputRef.current?.click()}>
            <FileArchive className="size-4" />
            Upload zip
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) uploadZip(e.target.files[0]!);
              e.target.value = "";
            }}
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex h-24 items-center justify-center rounded-lg border-2 border-dashed text-body-sm transition-colors ${
            dragOver ? "border-brand-primary bg-brand-primary/5 text-brand-primary" : "border-neutral-300 text-neutral-400"
          }`}
        >
          Drag and drop files here (uploaded as: {CATEGORY_LABELS[batchCategory]})
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by filename…" className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as LibraryAssetCategory | "ALL")}>
            <SelectTrigger className="h-10 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {LIBRARY_ASSET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {assets === null ? (
          <p className="text-body-sm text-neutral-400">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-body-sm text-neutral-400">No library assets match this search/filter.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {assets.map((asset) => (
              <div key={asset.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-2">
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-neutral-100">
                  {asset.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.thumbnailUrl} alt={asset.originalFilename} className="size-full object-cover" />
                  ) : (
                    <KindIcon kind={asset.kind} className="size-8 text-neutral-400" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="neutral" size="sm">
                    {asset.kind}
                  </Badge>
                  <Badge variant="info" size="sm">
                    {CATEGORY_LABELS[asset.category]}
                  </Badge>
                </div>
                <p className="truncate text-label-sm text-neutral-700" title={asset.originalFilename}>
                  {asset.originalFilename}
                </p>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => deleteAsset(asset)}
                    className="rounded p-1 text-neutral-400 hover:bg-error-light hover:text-error"
                    aria-label="Delete asset"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
