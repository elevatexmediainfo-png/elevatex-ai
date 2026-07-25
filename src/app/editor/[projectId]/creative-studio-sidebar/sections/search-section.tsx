"use client";

import * as React from "react";
import { Search as SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Search — a cross-category search surface, distinct from each panel's own
// local (in-panel) search box: this is meant to query Stock Videos/Images/
// Music/Fonts/etc. all at once. UI only — no aggregate search API exists
// yet, so submitting is a no-op for now.
const RECENT_SEARCHES = ["sunset beach", "upbeat pop", "lower third", "confetti"];
const TRENDING = ["product launch", "logo reveal", "vlog intro", "rain overlay"];

export function SearchSection() {
  const [query, setQuery] = React.useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-editor-line p-3">
        <h2 className="text-label-sm text-neutral-200">Search</h2>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-3 [scrollbar-gutter:stable]">
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => e.preventDefault()}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos, images, music, fonts…"
            className="h-9 border-editor-line bg-editor-surface-1 text-body-sm text-neutral-100 placeholder:text-neutral-500"
            autoFocus
          />
          <Button type="submit" variant="secondary" size="icon">
            <SearchIcon className="size-4" />
          </Button>
        </form>

        <ChipGroup label="Recent searches" items={RECENT_SEARCHES} onPick={setQuery} />
        <ChipGroup label="Trending" items={TRENDING} onPick={setQuery} />
      </div>
    </div>
  );
}

function ChipGroup({ label, items, onPick }: { label: string; items: string[]; onPick: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-caption text-neutral-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-full border border-editor-line bg-editor-surface-1 px-2.5 py-1 text-caption text-neutral-300 hover:border-editor-border-hover hover:text-white"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
