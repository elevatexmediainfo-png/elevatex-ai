"use client";

import * as React from "react";
import { Loader2, Music, Sparkles, Upload as UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditor, type AssetView } from "./editor-types";

const TABS = [
  { key: "AI_GENERATED", label: "AI generated" },
  { key: "UPLOAD", label: "Uploads" },
  { key: "STOCK", label: "Stock" },
  { key: "BRAND", label: "Brand" },
  { key: "MUSIC", label: "Music" },
] as const;

const UPLOAD_KINDS = ["IMAGE", "VIDEO", "VOICE", "STICKER"] as const;

// Media Library — upload assets, AI-generated assets, stock assets, brand
// assets, all through the SAME GET /api/assets the rest of the app already
// uses (filtered client-side by `source`), plus the admin-curated Stock/
// Music content libraries. Drag any item onto the Timeline to place it.
export function MediaLibraryPanel() {
  const { assets, stock, music, refreshAssets } = useEditor();
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("AI_GENERATED");
  const [uploading, setUploading] = React.useState(false);
  const [uploadKind, setUploadKind] = React.useState<(typeof UPLOAD_KINDS)[number]>("IMAGE");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file first.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", uploadKind);
      form.append("source", tab === "BRAND" ? "BRAND" : "UPLOAD");
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Upload failed.");
        return;
      }
      toast.success("Uploaded.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      refreshAssets();
    } catch {
      toast.error("Network error while uploading.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-label-md text-neutral-700">Media Library</p>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.key} type="button" variant={tab === t.key ? "chipActive" : "chip"} size="chip" onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {(tab === "UPLOAD" || tab === "BRAND") && (
        <form onSubmit={handleUpload} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
          <Select value={uploadKind} onValueChange={(v) => setUploadKind(v as typeof uploadKind)}>
            <SelectTrigger className="h-9 w-full" aria-label="File type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UPLOAD_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input ref={fileInputRef} type="file" />
          <Button type="submit" variant="outline" size="sm" disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
            Upload {tab === "BRAND" ? "brand asset" : "asset"}
          </Button>
        </form>
      )}

      {tab === "MUSIC" ? (
        <MusicGrid items={music} />
      ) : tab === "STOCK" ? (
        <StockGrid items={stock} />
      ) : (
        <AssetGrid items={assets.filter((a) => a.source === tab)} />
      )}
    </div>
  );
}

function draggablePropsForAsset(assetId: string, durationMs?: number) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("application/json", JSON.stringify({ assetId, durationMs }));
    },
  };
}

function AssetGrid({ items }: { items: AssetView[] }) {
  if (items.length === 0) {
    return <p className="text-body-sm text-neutral-500">Nothing here yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((a) => (
        <div
          key={a.id}
          {...draggablePropsForAsset(a.id, a.kind === "VOICE" ? 5000 : 3000)}
          className="cursor-grab overflow-hidden rounded-lg border border-neutral-200 bg-white"
          title="Drag onto the Timeline"
        >
          {a.kind === "IMAGE" || a.kind === "STICKER" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.label ?? a.kind} className="aspect-square w-full object-cover" />
          ) : a.kind === "VIDEO" ? (
            <video src={a.url} className="aspect-square w-full object-cover" muted />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-neutral-50">
              <Sparkles className="size-5 text-neutral-400" />
            </div>
          )}
          <p className="truncate px-1.5 py-1 text-[11px] text-neutral-600">{a.label ?? a.kind}</p>
        </div>
      ))}
    </div>
  );
}

function StockGrid({ items }: { items: { id: string; label: string; kind: string; url: string }[] }) {
  if (items.length === 0) {
    return <p className="text-body-sm text-neutral-500">No stock assets configured yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((s) => (
        <div
          key={s.id}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify({ durationMs: 3000, content: { sourceUrl: s.url } }))}
          className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
          title="Drag onto the Timeline"
        >
          {s.kind === "VIDEO" ? <video src={s.url} className="aspect-square w-full object-cover" muted /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.url} alt={s.label} className="aspect-square w-full object-cover" />
          )}
          <p className="truncate px-1.5 py-1 text-[11px] text-neutral-600">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function MusicGrid({ items }: { items: { id: string; label: string; url: string }[] }) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  if (items.length === 0) {
    return <p className="text-body-sm text-neutral-500">No background music configured yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <Music className="size-4 text-neutral-400" />
            <p className="text-body-sm text-neutral-700">{m.label}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPlayingId(playingId === m.id ? null : m.id)}>
            {playingId === m.id ? "Stop" : "Preview"}
          </Button>
          {playingId === m.id && <audio src={m.url} autoPlay onEnded={() => setPlayingId(null)} />}
        </div>
      ))}
    </div>
  );
}
