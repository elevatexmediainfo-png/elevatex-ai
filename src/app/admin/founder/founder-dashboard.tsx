"use client";

import * as React from "react";

import { formatDate } from "@/lib/format";

function rupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function dollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

interface SignupDayBucket {
  dayStart: string;
  count: number;
}

interface FounderDashboardReport {
  revenue: { todayPaise: number; mrr: number; arr: number; activeSubscriptions: number };
  usage: {
    activeUsersToday: number;
    videosGeneratedToday: number;
    talkingHeadVideosToday: number;
    imagesGeneratedToday: number;
    voiceMinutesToday: number;
    signupTrend: SignupDayBucket[];
  };
  cost: { apiCostTodayUsd: number; apiCostMonthUsd: number; mostUsedProvider: string | null };
  estimate: {
    profitTodayInr: number;
    grossMarginPercent: number | null;
    editorCostSavedInr: number;
    timeSavedMinutes: number;
    clvInr: number;
    arpuInr: number;
  };
  ops: {
    storageUsedBytes: number;
    queuePending: number;
    queueProcessing: number;
    queueFailedLast24h: number;
    creditsConsumedToday: number;
  };
}

function StatGrid({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="text-label-sm text-neutral-500">{stat.label}</p>
          <p className="mt-1 text-heading-3 text-neutral-900">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function FounderDashboard() {
  const [report, setReport] = React.useState<FounderDashboardReport | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/founder-dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setReport(json.data.dashboard);
      });
  }, []);

  if (!report) return <p className="text-body-sm text-neutral-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-label-lg text-neutral-900">Revenue</h2>
        <div className="mt-3">
          <StatGrid
            stats={[
              { label: "Revenue today", value: rupees(report.revenue.todayPaise / 100) },
              { label: "MRR", value: rupees(report.revenue.mrr / 100) },
              { label: "ARR", value: rupees(report.revenue.arr / 100) },
              { label: "Active subscriptions", value: String(report.revenue.activeSubscriptions) },
            ]}
          />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Usage today</h2>
        <div className="mt-3">
          <StatGrid
            stats={[
              { label: "Active users", value: String(report.usage.activeUsersToday) },
              { label: "Videos generated", value: String(report.usage.videosGeneratedToday) },
              { label: "Talking-head videos", value: String(report.usage.talkingHeadVideosToday) },
              { label: "Images generated", value: String(report.usage.imagesGeneratedToday) },
              { label: "Voice minutes", value: report.usage.voiceMinutesToday.toFixed(1) },
              { label: "Credits consumed", value: String(report.ops.creditsConsumedToday) },
            ]}
          />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">AI vendor cost</h2>
        <div className="mt-3">
          <StatGrid
            stats={[
              { label: "API cost today", value: dollars(report.cost.apiCostTodayUsd) },
              { label: "API cost this month", value: dollars(report.cost.apiCostMonthUsd) },
              { label: "Most used provider", value: report.cost.mostUsedProvider ?? "—" },
            ]}
          />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Estimates (approximate)</h2>
        <p className="mt-1 text-caption text-neutral-500">
          Combines INR revenue with USD cost via the admin-set USD→INR rate, and an admin-set
          assumption for outsourcing cost/time per video — adjust both in Revenue → Payment
          Settings.
        </p>
        <div className="mt-3">
          <StatGrid
            stats={[
              { label: "Estimated profit today", value: rupees(report.estimate.profitTodayInr) },
              {
                label: "Gross margin",
                value: report.estimate.grossMarginPercent === null ? "—" : `${report.estimate.grossMarginPercent.toFixed(0)}%`,
              },
              { label: "Editor cost saved (today)", value: rupees(report.estimate.editorCostSavedInr) },
              { label: "Time saved (today)", value: `${Math.round(report.estimate.timeSavedMinutes)} min` },
              { label: "CLV (avg, paying users)", value: rupees(report.estimate.clvInr) },
              { label: "ARPU (today)", value: rupees(report.estimate.arpuInr) },
            ]}
          />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Operations</h2>
        <div className="mt-3">
          <StatGrid
            stats={[
              { label: "Storage used", value: formatBytes(report.ops.storageUsedBytes) },
              { label: "Queue pending", value: String(report.ops.queuePending) },
              { label: "Queue processing", value: String(report.ops.queueProcessing) },
              { label: "Failed jobs (24h)", value: String(report.ops.queueFailedLast24h) },
            ]}
          />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Signups, last 30 days</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Day</th>
                <th className="px-4 py-2">Signups</th>
              </tr>
            </thead>
            <tbody>
              {report.usage.signupTrend.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-neutral-500">
                    No signups in this window.
                  </td>
                </tr>
              ) : (
                [...report.usage.signupTrend].reverse().map((row) => (
                  <tr key={row.dayStart} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{formatDate(new Date(row.dayStart))}</td>
                    <td className="px-4 py-2">{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
