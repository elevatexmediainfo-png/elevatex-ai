"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

import { SectionHeader } from "./section-header";

const VERTICAL_LABEL: Record<string, string> = {
  RESTAURANT: "Restaurant",
  CAFE_BAKERY: "Cafe & Bakery",
  SALON_SPA: "Salon & Spa",
  DENTAL_DIAGNOSTIC: "Dental & Diagnostics",
  REAL_ESTATE: "Real Estate",
  RETAIL: "Retail",
  GYM_FITNESS: "Gym & Fitness",
  HOSPITAL: "Healthcare",
  COACHING_EDTECH: "Education",
  HOTEL: "Hospitality",
  FINANCE: "Finance",
  OTHER: "Other",
};

interface FeaturedTemplate {
  id: string;
  name: string;
  vertical: string;
  thumbnailUrl: string | null;
  defaultObjective: string | null;
}

interface TemplateCardProps {
  template: FeaturedTemplate;
}

function TemplateCard({ template: t }: TemplateCardProps) {
  const href = t.defaultObjective
    ? `/create/video/script-ad?objective=${t.defaultObjective}`
    : "/create/video/script-ad";

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.01 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
    >
      <Link
        href={href}
        className="group flex flex-col overflow-hidden rounded-card border border-edge-card bg-glass-card backdrop-blur-xl transition-all duration-base ease-out hover:border-edge-hover hover:shadow-[0_16px_32px_-16px_rgba(23,23,35,0.16)] dark:hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]"
      >
        {/* 16:9 thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-glass-card">
          {t.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.thumbnailUrl}
              alt={t.name}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Sparkles className="size-7 text-dash-ink/20" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>

        {/* Card footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-dash-ink">{t.name}</p>
            <p className="mt-0.5 text-[12px] text-dash-ink/45">
              {VERTICAL_LABEL[t.vertical] ?? t.vertical}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-violet-600 dark:text-violet-400 transition-colors duration-150 group-hover:text-violet-500 dark:group-hover:text-violet-300">
            Use
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

interface TemplatesSectionProps {
  templates: FeaturedTemplate[];
}

export function TemplatesSection({ templates }: TemplatesSectionProps) {
  if (templates.length === 0) return null;

  return (
    <section>
      {/* Disambiguation fix (2026-07-25) — this section is backed by the OLD
          Template model (pre-built AI Video templates by vertical), a
          different feature from /marketing-templates (reference-image +
          logo-upload templates). Relabeled so it's no longer indistinguishable
          from that other, unrelated "Templates" surface — see
          dashboard-nav-items.ts's own comment for the full incident. */}
      <SectionHeader title="Video Templates" viewAllHref="/templates" viewAllLabel="Browse all" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.slice(0, 6).map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </section>
  );
}
