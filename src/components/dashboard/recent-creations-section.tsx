"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Edit3, Download, Clapperboard, Image as ImageIcon, Megaphone, Mic } from "lucide-react";

import type { ContinueWorkingItem, ContinueWorkingKind } from "@/lib/dashboard/continue-working";
import { SectionHeader } from "./section-header";

const KIND_ICONS: Record<ContinueWorkingKind, React.ComponentType<{ className?: string }>> = {
  VIDEO: Clapperboard,
  TALKING_HEAD: Mic,
  IMAGE: ImageIcon,
  MARKETING_CREATIVE: Megaphone,
};

function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// RSC serializes Date → string across the server/client boundary,
// so updatedAt arrives as string at runtime even though the type says Date.
type SerializedItem = Omit<ContinueWorkingItem, "updatedAt"> & {
  updatedAt: Date | string;
};

interface RecentCreationCardProps {
  item: SerializedItem;
}

function RecentCreationCard({ item }: RecentCreationCardProps) {
  const KindIcon = KIND_ICONS[item.kind] ?? Clapperboard;

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.01 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
    >
      <div className="group relative overflow-hidden rounded-card border border-edge-card bg-glass-card backdrop-blur-xl transition-all duration-base ease-out hover:border-edge-hover">
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] overflow-hidden bg-glass-thumb">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <KindIcon className="size-8 text-dash-ink/15" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="pointer-events-none absolute inset-0 bg-black/55 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100" />

          {/* Action buttons — appear on hover */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Link
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-medium text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/25"
              onClick={(e) => e.stopPropagation()}
            >
              <Edit3 className="size-3.5" />
              Edit
            </Link>
            {item.thumbnailUrl && (
              <a
                href={item.thumbnailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-medium text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/25"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="size-3.5" />
                Download
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <p className="truncate text-[13px] font-medium text-dash-ink">{item.title}</p>
          <span className="shrink-0 text-[11px] text-dash-ink/35">
            {formatRelative(item.updatedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

interface RecentCreationsSectionProps {
  items: ContinueWorkingItem[];
}

export function RecentCreationsSection({ items }: RecentCreationsSectionProps) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Recent creations" viewAllHref="/projects" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <RecentCreationCard key={item.id} item={item as SerializedItem} />
        ))}
      </div>
    </section>
  );
}
