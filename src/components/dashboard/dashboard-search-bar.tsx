"use client";

import * as React from "react";
import Link from "next/link";
import { Search, FileVideo, ImageIcon, LayoutTemplate } from "lucide-react";

import { Input } from "@/components/ui/input";

interface SearchResult {
  kind: "VIDEO_PROJECT" | "CREATIVE_PROJECT" | "TEMPLATE";
  id: string;
  title: string;
  href: string;
}

const KIND_ICON = {
  VIDEO_PROJECT: FileVideo,
  CREATIVE_PROJECT: ImageIcon,
  TEMPLATE: LayoutTemplate,
};

// Real substring search across the user's own content (videos, creatives,
// templates) — not "AI search", there's no semantic search infra here.
// Lives in the dashboard header (a different job from the hero's prompt
// box, which creates new content rather than finding existing content).
export function DashboardSearchBar() {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setResults(json.data.results);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search your content…"
        className="h-9 border-white/10 bg-white/5 pl-9 text-body-sm text-white placeholder:text-white/40 focus-visible:ring-white/20"
      />
      {open && query.trim() && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-surface-2/95 shadow-2xl backdrop-blur-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-body-sm text-white/50">No matches yet — keep typing.</p>
          ) : (
            results.map((r) => {
              const Icon = KIND_ICON[r.kind];
              return (
                <Link
                  key={`${r.kind}:${r.id}`}
                  href={r.href}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-body-sm text-white/80 hover:bg-white/5"
                >
                  <Icon className="size-4 text-white/40" />
                  {r.title}
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
