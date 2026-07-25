"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Palette, LayoutTemplate, type LucideIcon } from "lucide-react";

import { ToolIcon } from "./tool-icon";
import { resolveToolHref } from "@/lib/dashboard/tool-routing";

interface DBTool {
  id: string;
  icon: string;
  label: string;
  description: string | null;
  gradientFrom: string | null;
  gradientTo: string | null;
  pipeline: string;
  routeOverride: string | null;
  presetKey: string | null;
}

type DBCard = {
  id: string;
  label: string;
  description: string;
  href: string;
  gradientFrom: string;
  gradientTo: string;
  iconName: string;
  Icon?: never;
};

type StaticCard = {
  id: string;
  label: string;
  description: string;
  href: string;
  gradientFrom: string;
  gradientTo: string;
  Icon: LucideIcon;
  iconName?: never;
};

type UnifiedCard = DBCard | StaticCard;

const STATIC_CARDS: StaticCard[] = [
  {
    id: "brand-kit",
    label: "Brand Kit",
    description: "Your brand colors, fonts, and assets",
    href: "/brand-kit",
    gradientFrom: "#7C3AED",
    gradientTo: "#4F46E5",
    Icon: Palette,
  },
  {
    // Repointed 2026-07-24 — this was the dashboard's only entry point
    // into the OLD /templates gallery (GENERATED script-ad wizard
    // pre-fills). Per explicit founder decision, it now points at the new
    // Marketing Templates gallery instead — one "Templates" card, not two
    // confusingly similar ones in the same row. /templates itself is
    // untouched and still reachable by direct URL, it just lost its
    // dashboard shortcut.
    id: "templates",
    label: "Templates",
    description: "Personalize a marketing image or video with your logo",
    href: "/marketing-templates",
    gradientFrom: "#0EA5E9",
    gradientTo: "#2563EB",
    Icon: LayoutTemplate,
  },
];

function toDBCard(t: DBTool): DBCard {
  return {
    id: t.id,
    label: t.label,
    description: t.description ?? "Create with AI",
    href: resolveToolHref(t),
    gradientFrom: t.gradientFrom ?? "#7C3AED",
    gradientTo: t.gradientTo ?? "#2563EB",
    iconName: t.icon,
  };
}

export function QuickActionsGrid({ tools }: { tools: DBTool[] }) {
  const allCards: UnifiedCard[] = [
    ...tools.slice(0, 4).map(toDBCard),
    ...STATIC_CARDS,
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {allCards.map((card) => (
        <QuickActionCard key={card.id} card={card} />
      ))}
    </div>
  );
}

function QuickActionCard({ card }: { card: UnifiedCard }) {
  const gradient = `linear-gradient(135deg, ${card.gradientFrom} 0%, ${card.gradientTo} 100%)`;

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
      className="h-full"
    >
      <Link
        href={card.href}
        className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-card border border-edge-card bg-glass-card p-6 backdrop-blur-xl transition-all duration-base ease-out hover:border-edge-hover hover:bg-glass-soft hover:shadow-[0_16px_32px_-16px_rgba(23,23,35,0.16)] dark:hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]"
      >
        {/* Gradient border on hover — mask-composite technique */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-card opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            padding: 1,
            backgroundImage: gradient,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Decorative glow blob */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -right-6 size-24 rounded-full blur-2xl opacity-[0.14] transition-opacity duration-300 group-hover:opacity-25"
          style={{ backgroundImage: gradient }}
        />

        {/* Top row: icon + arrow */}
        <div className="flex items-start justify-between">
          <span
            className="flex size-12 items-center justify-center rounded-2xl text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.20)]"
            style={{ backgroundImage: gradient }}
          >
            {card.Icon ? (
              <card.Icon className="size-6" />
            ) : (
              <ToolIcon name={card.iconName} className="size-6" />
            )}
          </span>
          <ArrowUpRight
            className="size-4 text-dash-ink/25 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-dash-ink/60"
          />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-dash-ink">{card.label}</p>
          <p className="text-[13px] leading-snug text-dash-ink/50">{card.description}</p>
        </div>
      </Link>
    </motion.div>
  );
}
