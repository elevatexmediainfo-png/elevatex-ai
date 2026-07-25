"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clapperboard, Image as ImageIcon, Megaphone, Mic } from "lucide-react";

import { dashboardCardClass } from "./dashboard-card";
import type { ContinueWorkingKind } from "@/lib/dashboard/continue-working";

const KIND_ICONS: Record<ContinueWorkingKind, React.ComponentType<{ className?: string }>> = {
  VIDEO: Clapperboard,
  TALKING_HEAD: Mic,
  IMAGE: ImageIcon,
  MARKETING_CREATIVE: Megaphone,
};

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  PROCESSING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  QUEUED: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  RENDERING: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  FAILED: "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_FALLBACK = "text-dash-ink/40 bg-dash-ink/[0.04] border-dash-ink/[0.08]";

function toStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export interface PremiumProjectCardProps {
  title: string;
  thumbnailUrl: string | null;
  status: string;
  kind: ContinueWorkingKind;
  href: string;
  updatedAtLabel: string;
}

export function PremiumProjectCard({
  title,
  thumbnailUrl,
  status,
  kind,
  href,
  updatedAtLabel,
}: PremiumProjectCardProps) {
  const KindIcon = KIND_ICONS[kind] ?? Clapperboard;
  const statusStyle = STATUS_STYLES[status] ?? STATUS_FALLBACK;

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
      className="h-full"
    >
      <Link
        href={href}
        className={dashboardCardClass(
          { padding: "none" },
          "group flex h-full flex-col overflow-hidden",
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-dash-ink/[0.03]">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <KindIcon className="size-8 text-dash-ink/15" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>

        {/* Card body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-dash-ink">
            {title}
          </p>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle}`}
            >
              {toStatusLabel(status)}
            </span>
            <span className="text-[12px] text-dash-ink/35">{updatedAtLabel}</span>
          </div>

          <div className="mt-auto flex items-center gap-1 text-[12.5px] font-medium text-violet-600 dark:text-violet-400 transition-colors duration-150 group-hover:text-violet-500 dark:group-hover:text-violet-300">
            Continue
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
