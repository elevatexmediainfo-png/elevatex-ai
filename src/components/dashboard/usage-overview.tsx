import { Wallet, Clapperboard, ImageIcon, HardDrive, Activity, BarChart3 } from "lucide-react";

import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { dashboardCardClass } from "@/components/dashboard/dashboard-card";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import type { DashboardStats } from "@/lib/dashboard/get-dashboard-data";
import type { DailyActivity } from "@/lib/dashboard/recent-activity";

// Dashboard redesign — matches the brief's exact 5-metric list (Credits,
// Images, Videos, Storage, API usage), now in leaner/smaller cards on the
// shared card system. "Projects" is dropped — it's a pure sum of the other
// counts, no new information. Talking Head count is folded into the Videos
// card as a sub-label (same underlying VideoProject rows, distinguished
// only by sourceType). Credits gets a real progress RING (balance / plan's
// monthlyCredits) only for subscribed users — pay-per-download users have
// no monthly cap to honestly chart against, so they keep a plain number.
// recentActivity is real per-day GenerationLog counts, not a fabricated
// chart — it renders as a tiny 7-bar sparkline in its own card.
export function UsageOverview({ stats, recentActivity }: { stats: DashboardStats; recentActivity: DailyActivity[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard
        icon={Wallet}
        label="Credits remaining"
        value={stats.credits}
        accent="text-accent-orange bg-accent-orange/15"
        progress={stats.monthlyCreditsCap ? Math.min(100, (stats.credits / stats.monthlyCreditsCap) * 100) : undefined}
        sublabel={stats.monthlyCreditsCap ? `of ${stats.monthlyCreditsCap} this cycle` : undefined}
      />
      <StatCard
        icon={Clapperboard}
        label="Videos"
        value={stats.videos + stats.talkingHeads}
        accent="text-indigo-400 bg-indigo-400/15"
        sublabel={stats.talkingHeads > 0 ? `incl. ${stats.talkingHeads} talking head` : undefined}
      />
      <StatCard icon={ImageIcon} label="Images" value={stats.images} accent="text-info bg-info/15" />
      <StatCard icon={HardDrive} label="Storage used" value={stats.storageBytes} accent="text-warning bg-warning/15" unit="bytes" />
      <StatCard icon={Activity} label="API usage this month" value={stats.apiUsageThisMonth} accent="text-info bg-info/15" />
      <ActivitySparkline data={recentActivity} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  unit,
  sublabel,
  progress,
}: {
  icon: typeof Wallet;
  label: string;
  value: number;
  accent: string;
  unit?: "bytes";
  sublabel?: string;
  /** 0–100; renders the icon inside a progress ring instead of a flat badge when provided. */
  progress?: number;
}) {
  const [accentText, accentBg] = accent.split(" ");
  return (
    <div className={dashboardCardClass({ padding: "sm" }, "flex flex-col gap-3")}>
      <div className="flex items-center gap-3">
        {progress !== undefined ? (
          <span className={`relative flex size-9 shrink-0 items-center justify-center ${accentText}`}>
            <ProgressRing percent={progress} size={36} strokeWidth={3} className="absolute inset-0" />
            <Icon className="size-4" />
          </span>
        ) : (
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 ${accentBg} ${accentText}`}
          >
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-heading-2 text-white">
            <AnimatedCounter value={value} unit={unit} />
          </p>
          <p className="truncate text-body-sm text-white/50">{label}</p>
        </div>
      </div>
      {sublabel && <p className="text-label-sm text-white/35">{sublabel}</p>}
    </div>
  );
}

function ActivitySparkline({ data }: { data: DailyActivity[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className={dashboardCardClass({ padding: "sm" }, "flex flex-col gap-3")}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/15 text-info ring-1 ring-inset ring-black/5">
          <BarChart3 className="size-4" />
        </span>
        <p className="text-body-sm text-white/50">Last 7 days</p>
      </div>
      <div className="flex h-8 items-end gap-1">
        {data.map((d) => (
          <span
            key={d.date}
            className="flex-1 rounded-sm bg-gradient-to-t from-indigo-500/70 to-purple-400/70 transition-all"
            style={{ height: `${Math.max(8, (d.count / max) * 100)}%` }}
            title={`${d.date}: ${d.count}`}
          />
        ))}
      </div>
    </div>
  );
}
