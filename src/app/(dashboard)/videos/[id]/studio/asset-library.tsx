"use client";

import * as React from "react";
import { Loader2, Music, Image as ImageIcon, Video as VideoIcon, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AssetKind = "IMAGE" | "VIDEO" | "VOICE";

interface AssetView {
  id: string;
  kind: AssetKind;
  url: string;
  label: string | null;
  videoProjectId: string | null;
  sceneId: string | null;
  createdAt: string;
}

interface MusicEntry {
  id: string;
  label: string;
  url: string;
}

const FILTERS = [
  { key: "ALL", label: "All", icon: null },
  { key: "IMAGE", label: "Images", icon: ImageIcon },
  { key: "VIDEO", label: "Videos", icon: VideoIcon },
  { key: "VOICE", label: "Voiceovers", icon: Mic },
  { key: "MUSIC", label: "Music", icon: Music },
] as const;

// Asset Library — every generated/uploaded file across the user's projects
// (not just this one), since the library is a user-wide resource. "Music"
// has no per-user rows; it's the admin-configured library, fetched
// alongside the user's own assets from the same endpoint.
export function AssetLibrary() {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("ALL");
  const [assets, setAssets] = React.useState<AssetView[] | null>(null);
  const [music, setMusic] = React.useState<MusicEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    const kind = filter === "ALL" || filter === "MUSIC" ? "" : `?kind=${filter}`;
    fetch(`/api/assets${kind}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setAssets(json.data.assets);
          setMusic(json.data.music);
        }
      })
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            variant={filter === f.key ? "chipActive" : "chip"}
            size="chip"
            onClick={() => setFilter(f.key)}
          >
            {f.icon && <f.icon className="size-3.5" />}
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : filter === "MUSIC" ? (
        <MusicGrid items={music} />
      ) : (
        <AssetGrid items={assets ?? []} />
      )}
    </div>
  );
}

function AssetGrid({ items }: { items: AssetView[] }) {
  if (items.length === 0) {
    return <p className="mt-8 text-body-md text-neutral-500">Nothing here yet — generated files show up automatically.</p>;
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((a) => (
        <div key={a.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {a.kind === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.label ?? "Generated image"} className="aspect-square w-full object-cover" />
          ) : a.kind === "VIDEO" ? (
            <video src={a.url} className="aspect-square w-full object-cover" muted />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-neutral-50">
              <Mic className="size-6 text-neutral-400" />
            </div>
          )}
          <div className="px-2 py-1.5">
            <p className="truncate text-label-sm text-neutral-700">{a.label ?? a.kind}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MusicGrid({ items }: { items: MusicEntry[] }) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  if (items.length === 0) {
    return <p className="mt-8 text-body-md text-neutral-500">No background music tracks configured yet.</p>;
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      {items.map((m) => (
        <div
          key={m.id}
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
            playingId === m.id ? "border-brand-navy" : "border-neutral-200"
          )}
        >
          <p className="text-body-sm text-neutral-700">{m.label}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPlayingId(playingId === m.id ? null : m.id)}
          >
            {playingId === m.id ? "Stop" : "Preview"}
          </Button>
          {playingId === m.id && <audio src={m.url} autoPlay onEnded={() => setPlayingId(null)} />}
        </div>
      ))}
    </div>
  );
}
