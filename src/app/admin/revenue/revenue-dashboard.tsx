"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface RevenueByKind {
  kind: string;
  revenuePaise: number;
  count: number;
}

interface RevenueDayBucket {
  dayStart: string;
  revenuePaise: number;
  count: number;
}

interface TopPlanRevenue {
  planId: string;
  name: string;
  revenuePaise: number;
  count: number;
}

interface RevenueReport {
  summary: { totalRevenuePaise: number; byKind: RevenueByKind[] };
  byDay: RevenueDayBucket[];
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  topPlans: TopPlanRevenue[];
}

const WINDOWS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

export function RevenueDashboard() {
  const [days, setDays] = React.useState<number>(30);
  const [report, setReport] = React.useState<RevenueReport | null>(null);

  React.useEffect(() => {
    setReport(null);
    fetch(`/api/admin/revenue?days=${days}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setReport(json.data.report);
      });
  }, [days]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        {WINDOWS.map((w) => (
          <Button
            key={w.days}
            type="button"
            size="sm"
            variant={days === w.days ? "primary" : "secondary"}
            onClick={() => setDays(w.days)}
          >
            {w.label}
          </Button>
        ))}
      </div>

      {!report ? (
        <p className="text-body-sm text-neutral-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: `Revenue (${days}d)`, value: rupees(report.summary.totalRevenuePaise) },
              { label: "MRR", value: rupees(report.mrr) },
              { label: "ARR", value: rupees(report.arr) },
              { label: "Active subscriptions", value: report.activeSubscriptions },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <p className="text-label-sm text-neutral-500">{stat.label}</p>
                <p className="mt-1 text-heading-3 text-neutral-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-label-lg text-neutral-900">Revenue by kind</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {report.summary.byKind.length === 0 ? (
                <p className="text-body-sm text-neutral-500">No settled payments in this window.</p>
              ) : (
                report.summary.byKind.map((row) => (
                  <div key={row.kind} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <p className="text-label-sm text-neutral-500">{row.kind}</p>
                    <p className="mt-1 text-heading-3 text-neutral-900">{rupees(row.revenuePaise)}</p>
                    <p className="text-caption text-neutral-500">{row.count} payment(s)</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-label-lg text-neutral-900">Revenue by day</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Day</th>
                    <th className="px-4 py-2">Revenue</th>
                    <th className="px-4 py-2">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDay.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                        No settled payments in this window.
                      </td>
                    </tr>
                  ) : (
                    [...report.byDay].reverse().map((row) => (
                      <tr key={row.dayStart} className="border-b border-neutral-100 last:border-0">
                        <td className="px-4 py-2">{formatDate(new Date(row.dayStart))}</td>
                        <td className="px-4 py-2">{rupees(row.revenuePaise)}</td>
                        <td className="px-4 py-2 text-neutral-500">{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-label-lg text-neutral-900">Top plans by revenue</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Plan</th>
                    <th className="px-4 py-2">Revenue</th>
                    <th className="px-4 py-2">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topPlans.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                        No subscription payments in this window.
                      </td>
                    </tr>
                  ) : (
                    report.topPlans.map((row) => (
                      <tr key={row.planId} className="border-b border-neutral-100 last:border-0">
                        <td className="px-4 py-2">{row.name}</td>
                        <td className="px-4 py-2">{rupees(row.revenuePaise)}</td>
                        <td className="px-4 py-2 text-neutral-500">{row.count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
