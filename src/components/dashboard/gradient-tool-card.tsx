"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Coins, Sparkles } from "lucide-react";

import { ToolIcon } from "./tool-icon";
import { TiltCard } from "./tilt-card";
import { dashboardCardClass } from "./dashboard-card";

export interface GradientToolCardProps {
  href: string;
  icon: string;
  label: string;
  description?: string | null;
  gradientFrom?: string | null;
  gradientTo?: string | null;
  creditCostEstimate: number;
  estimatedSeconds: number;
  /** Overrides the auto-formatted "N credit(s)" text — for a cost that
   * isn't a single flat number (e.g. AI Video's real per-scene pricing,
   * where scene count is decided dynamically by scene-split and a flat
   * number would just be wrong most of the time). `creditCostEstimate` is
   * still required as a prop but goes unrendered when this is set.
   * Optional and backward-compatible — no existing caller (QuickCreateGrid)
   * passes it, so their rendering is unchanged. */
  creditLabel?: string;
  /** Visual prominence for the flagship product (AI Video Editor) — same
   * card size as its siblings, richer gradient + a persistent glow + a
   * small badge instead. Set via `tool.pipeline === "VIDEO"` in
   * QuickCreateGrid, not hardcoded by position, so it stays data-driven. */
  flagship?: boolean;
}

export function GradientToolCard({
  href,
  icon,
  label,
  description,
  gradientFrom,
  gradientTo,
  creditCostEstimate,
  estimatedSeconds,
  creditLabel,
  flagship = false,
}: GradientToolCardProps) {
  const from = gradientFrom ?? "#6366f1";
  const to = gradientTo ?? "#a855f7";
  // Flagship gets a richer 3-stop gradient (adds a cyan mid-stop) instead
  // of a bigger card — visual weight, not physical size.
  const gradient = flagship ? `linear-gradient(135deg, ${from}, #06b6d4, ${to})` : `linear-gradient(135deg, ${from}, ${to})`;

  return (
    <motion.div whileHover={{ y: -4, scale: 1.02 }} transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }} className="h-full">
      <TiltCard className="group relative h-full rounded-[20px]">
        <Link
          href={href}
          className={dashboardCardClass(
            { interactive: false },
            `relative flex h-full flex-col gap-3 overflow-hidden transition-shadow duration-200 hover:shadow-[0_16px_40px_-16px_var(--glow)] ${
              flagship ? "shadow-[0_0_32px_-12px_var(--glow)]" : ""
            }`
          )}
          style={{ "--glow": `${from}80` } as React.CSSProperties}
        >
          {flagship && (
            <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-dash-ink/10 px-2 py-0.5 text-label-sm text-dash-ink/90 ring-1 ring-inset ring-dash-ink/15 backdrop-blur-sm">
              <Sparkles className="size-3 text-accent-orange" /> Flagship
            </span>
          )}
          {/* Gradient border ring — persistent (low opacity) for the flagship card, hover-only for everything else; same mask-composite "exclude" technique. */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-[20px] transition-opacity duration-[220ms] ease-out group-hover:opacity-100 ${
              flagship ? "opacity-40" : "opacity-0"
            }`}
            style={{
              padding: 1.5,
              backgroundImage: gradient,
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          {/* Soft abstract preview blob — brand-color decoration, not a stock illustration. */}
          <span
            aria-hidden
            className={`pointer-events-none absolute -bottom-8 -right-8 size-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-25 ${
              flagship ? "opacity-20" : "opacity-[0.12]"
            }`}
            style={{ backgroundImage: gradient }}
          />

          <span
            className="flex size-11 items-center justify-center rounded-xl text-white shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.35)] ring-1 ring-inset ring-white/15"
            style={{ backgroundImage: gradient }}
          >
            <ToolIcon name={icon} className="size-5" />
          </span>
          <div>
            <p className="text-label-lg text-dash-ink">{label}</p>
            {description && <p className="mt-1 text-body-sm text-dash-ink/55">{description}</p>}
          </div>
          <div className="mt-auto flex items-center gap-3 text-label-sm text-dash-ink/55">
            <span className="inline-flex items-center gap-1">
              <Coins className="size-3.5" /> {creditLabel ?? `${creditCostEstimate} credit${creditCostEstimate === 1 ? "" : "s"}`}
            </span>
            {estimatedSeconds > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> ~{estimatedSeconds}s
              </span>
            )}
          </div>
          <span
            className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-[0.06]"
            style={{ backgroundImage: gradient }}
          />
        </Link>
      </TiltCard>
    </motion.div>
  );
}

export interface QuickActionChipProps {
  href: string;
  icon: string;
  label: string;
  gradientFrom?: string | null;
  gradientTo?: string | null;
}

export function QuickActionChip({ href, icon, label, gradientFrom, gradientTo }: QuickActionChipProps) {
  const from = gradientFrom ?? "#6366f1";
  const to = gradientTo ?? "#a855f7";

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}>
      <Link
        href={href}
        className="group flex items-center gap-2.5 rounded-full border border-dash-ink/10 bg-dash-ink/5 px-3.5 py-2 text-label-sm font-medium text-dash-ink/80 shadow-sm transition-all duration-150 hover:border-transparent hover:bg-dash-ink/10 hover:shadow-md"
        style={{ backgroundImage: `linear-gradient(135deg, ${from}1f, ${to}12)` }}
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-1 ring-inset ring-white/15 transition-transform duration-150 group-hover:scale-110"
          style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          <ToolIcon name={icon} className="size-3.5" />
        </span>
        {label}
      </Link>
    </motion.div>
  );
}
