"use client";

import { motion } from "framer-motion";
import { Zap, FolderOpen, Activity, HardDrive } from "lucide-react";

import { AnimatedCounter } from "./animated-counter";
import { SectionHeader } from "./section-header";
import type { DashboardStats } from "@/lib/dashboard/get-dashboard-data";

interface MetricCardProps {
  label: string;
  sublabel: string;
  value: number;
  unit?: "bytes";
  Icon: React.ComponentType<{ className?: string }>;
  gradientFrom: string;
  gradientTo: string;
  cap?: number | null;
}

function MetricCard({
  label,
  sublabel,
  value,
  unit,
  Icon,
  gradientFrom,
  gradientTo,
  cap,
}: MetricCardProps) {
  const gradient = `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`;
  const pct = cap && cap > 0 ? Math.min((value / cap) * 100, 100) : null;

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.01 }}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
      className="relative flex flex-col gap-4 overflow-hidden rounded-card border border-edge-card bg-glass-card p-5 backdrop-blur-xl"
    >
      {/* Decorative glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -right-4 size-20 rounded-full blur-2xl opacity-[0.12]"
        style={{ backgroundImage: gradient }}
      />

      <div className="flex items-center justify-between">
        <span
          className="flex size-10 items-center justify-center rounded-xl text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.15)]"
          style={{ backgroundImage: gradient }}
        >
          <Icon className="size-5" />
        </span>
        {pct !== null && (
          <span className="text-[11px] font-medium text-dash-ink/40">
            {Math.round(pct)}% used
          </span>
        )}
      </div>

      <div>
        <p className="text-[26px] font-bold tracking-[-0.5px] text-dash-ink leading-none">
          <AnimatedCounter value={value} unit={unit} />
        </p>
        <p className="mt-1 text-[13px] font-medium text-dash-ink/55">{label}</p>
        <p className="mt-0.5 text-[11.5px] text-dash-ink/30">{sublabel}</p>
      </div>

      {pct !== null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-dash-ink/[0.07]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundImage: gradient }}
          />
        </div>
      )}
    </motion.div>
  );
}

interface DashboardMetricsProps {
  stats: DashboardStats;
}

export function DashboardMetrics({ stats }: DashboardMetricsProps) {
  return (
    <section>
      <SectionHeader title="Your workspace" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Credits"
          sublabel="Available balance"
          value={stats.credits}
          Icon={Zap}
          gradientFrom="#7C3AED"
          gradientTo="#2563EB"
          cap={stats.monthlyCreditsCap}
        />
        <MetricCard
          label="Projects"
          sublabel="Total created"
          value={stats.projects}
          Icon={FolderOpen}
          gradientFrom="#0EA5E9"
          gradientTo="#2563EB"
        />
        <MetricCard
          label="Generations"
          sublabel="This month"
          value={stats.apiUsageThisMonth}
          Icon={Activity}
          gradientFrom="#7C3AED"
          gradientTo="#A855F7"
        />
        <MetricCard
          label="Storage"
          sublabel="Used"
          value={stats.storageBytes}
          unit="bytes"
          Icon={HardDrive}
          gradientFrom="#2563EB"
          gradientTo="#0EA5E9"
        />
      </div>
    </section>
  );
}
