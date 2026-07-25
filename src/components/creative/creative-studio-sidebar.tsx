"use client";

import * as React from "react";
import {
  Search,
  UploadCloud,
  Film,
  ImageIcon,
  Music,
  Volume2,
  Type,
  FileText,
  ArrowRightLeft,
  Sparkles,
  Sticker,
  Square,
  ShieldCheck,
  FolderKanban,
  Layers,
  User,
  Heart,
  Clock3,
  Grid,
  Filter,
  SlidersHorizontal,
  Sparkles as SparkleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Uploads", icon: UploadCloud },
  { label: "Stock Videos", icon: Film },
  { label: "Stock Images", icon: ImageIcon },
  { label: "Stock Music", icon: Music },
  { label: "Sound Effects", icon: Volume2 },
  { label: "Fonts", icon: Type },
  { label: "Text Templates", icon: FileText },
  { label: "Motion Graphics", icon: ArrowRightLeft },
  { label: "Transitions", icon: ArrowRightLeft },
  { label: "Effects", icon: Sparkles },
  { label: "Stickers", icon: Sticker },
  { label: "Icons", icon: Grid },
  { label: "Shapes", icon: Square },
  { label: "Logos", icon: ShieldCheck },
  { label: "Brand Kit", icon: ShieldCheck },
];

const LIBRARY_LINKS = [
  { label: "Projects", icon: FolderKanban },
  { label: "Scene Library", icon: Layers },
  { label: "Character Library", icon: User },
  { label: "Favorites", icon: Heart },
  { label: "Recent Assets", icon: Clock3 },
  { label: "Collections", icon: Grid },
];

const CATEGORIES = [
  "All",
  "Video",
  "Image",
  "Audio",
  "Graphics",
  "Fonts",
  "Brand",
];

const FILTERS = [
  "Popular",
  "New",
  "Favorites",
  "Trending",
  "Recently Added",
];

const COLLECTIONS = [
  { title: "Brand Essentials", tag: "Logo + Assets" },
  { title: "Social Campaign", tag: "Video + Templates" },
  { title: "Storyboard Kit", tag: "Scenes + Music" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm shadow-slate-950/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-500">{title}</p>
          {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function InteractiveChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition hover:border-brand-navy hover:bg-brand-navy-light hover:text-brand-navy",
        active
          ? "border-brand-navy bg-brand-navy-light text-brand-navy"
          : "border-neutral-200 bg-white text-neutral-700"
      )}
    >
      {label}
    </button>
  );
}

function TileButton({ label, icon: Icon, active, onClick }: { label: string; icon: React.ComponentType<{ className?: string }> ; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-3xl border p-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-brand-navy/50",
        active ? "border-brand-navy bg-brand-navy-light text-brand-navy shadow-sm shadow-brand-navy/10" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700 group-hover:bg-brand-navy/10 group-hover:text-brand-navy">
        <Icon className="size-5" />
      </span>
      <span className="truncate text-sm font-medium">{label}</span>
    </button>
  );
}

function CollectionCard({ title, tag }: { title: string; tag: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-slate-950/5 p-3 transition hover:border-brand-navy">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-navy/10 text-brand-navy">
          <SparkleIcon className="size-4" />
        </span>
        <Badge variant="brand" size="sm">
          curated
        </Badge>
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{tag}</p>
    </div>
  );
}

export function CreativeStudioSidebar() {
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("All");
  const [activeFilter, setActiveFilter] = React.useState("Popular");
  const [activeTile, setActiveTile] = React.useState("Uploads");

  const filteredNavItems = React.useMemo(() => {
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const filteredLibraryLinks = React.useMemo(() => {
    return LIBRARY_LINKS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <aside className="flex h-full min-h-[calc(100vh-0px)] flex-col gap-4 overflow-hidden">
      <div className="rounded-[2rem] border border-neutral-200 bg-white/95 p-5 shadow-xl shadow-slate-950/5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-label-lg font-semibold text-neutral-900">Creative Studio</p>
            <p className="mt-2 text-sm text-neutral-500">Premium asset browser, brand kit, and creative tools in one place.</p>
          </div>
          <Badge variant="brand" size="sm">
            Studio
          </Badge>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets, templates, categories..."
            className="pl-10"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <InteractiveChip
              key={category}
              label={category}
              active={category === activeCategory}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto pr-1">
        <Section title="Quick access" description="Jump to the core creative sources and content buckets.">
          <div className="grid grid-cols-2 gap-3">
            {filteredNavItems.slice(0, 12).map((item) => (
              <TileButton
                key={item.label}
                label={item.label}
                icon={item.icon}
                active={item.label === activeTile}
                onClick={() => setActiveTile(item.label)}
              />
            ))}
          </div>
        </Section>

        <Section title="Libraries & collections" description="Access saved projects, scenes, characters and curated packs.">
          <div className="grid gap-3">
            {filteredLibraryLinks.map((item) => (
              <TileButton
                key={item.label}
                label={item.label}
                icon={item.icon}
                active={item.label === activeTile}
                onClick={() => setActiveTile(item.label)}
              />
            ))}
          </div>
        </Section>

        <Section title="Filters" description="Refine the studio view by curated tags.">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <InteractiveChip
                key={filter}
                label={filter}
                active={filter === activeFilter}
                onClick={() => setActiveFilter(filter)}
              />
            ))}
          </div>
        </Section>

        <Section title="Collections" description="Creative collections crafted for rapid editing.">
          <div className="grid gap-3">
            {COLLECTIONS.map((collection) => (
              <CollectionCard key={collection.title} title={collection.title} tag={collection.tag} />
            ))}
          </div>
        </Section>

        <Section title="Brand tools" description="Keep your brand assets close to every creative session.">
          <div className="grid gap-3">
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-brand-navy/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">Brand Kit</p>
                  <p className="mt-1 text-sm text-neutral-500">Logo colors, fonts, and approved assets.</p>
                </div>
                <Badge variant="brand" size="sm">
                  live
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-navy text-white">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="text-sm text-neutral-700">Ready for all projects</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="secondary" size="sm">
                  Open kit
                </Button>
                <Button type="button" variant="outline" size="sm">
                  View logos
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </aside>
  );
}
