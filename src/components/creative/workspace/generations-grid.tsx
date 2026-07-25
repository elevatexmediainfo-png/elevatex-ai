"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";

interface GenerationItem {
  id: string;
  title: string;
  resultUrl: string;
  editHref: string;
}

function kindToHref(kind: string, id: string): string {
  if (kind === "AI_IMAGE") return `/images?projectId=${id}#${id}`;
  return `/marketing-creatives?projectId=${id}#${id}`;
}

interface GenerationsGridProps {
  kind: string;
}

export function GenerationsGrid({ kind }: GenerationsGridProps) {
  const [items, setItems] = React.useState<GenerationItem[]>([]);

  React.useEffect(() => {
    fetch(`/api/creative-projects?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data) return;
        const withImages = (json.data as Array<{ id: string; title: string; resultUrl?: string | null }>)
          .filter((p) => !!p.resultUrl)
          .slice(0, 24);
        setItems(
          withImages.map((p) => ({
            id: p.id,
            title: p.title,
            resultUrl: p.resultUrl!,
            editHref: kindToHref(kind, p.id),
          })),
        );
      })
      .catch(() => null);
  }, [kind]);

  if (items.length === 0) return null;

  return (
    <div className="mt-12 px-6 pb-16 lg:px-10">
      <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-widest text-white/25">
        Previous generations
      </p>
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {items.map((item, i) => (
          <GenerationCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

function GenerationCard({ item, index }: { item: GenerationItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.6), ease: [0, 0, 0.2, 1] }}
      className="group relative mb-3 break-inside-avoid overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.025]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.resultUrl}
        alt={item.title}
        className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <p className="mb-2 line-clamp-2 text-[11.5px] font-medium text-white/85">{item.title}</p>
        <div className="flex items-center gap-1.5">
          <a
            href={item.resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/35"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="size-3.5" />
          </a>
          <Link
            href={item.editHref}
            title="Open"
            className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/35"
          >
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
