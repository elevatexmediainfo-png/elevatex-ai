"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format";

interface StorageUsageGroup {
  group: string;
  count: number;
  totalBytes: number;
}

interface StorageUsageSummary {
  byKind: StorageUsageGroup[];
  bySource: StorageUsageGroup[];
  totalAssets: number;
  totalKnownBytes: number;
  reachability: { ok: boolean; message: string } | null;
}

export function StorageDashboard() {
  const [summary, setSummary] = React.useState<StorageUsageSummary | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/storage")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setSummary(json.data.summary);
      });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-label-lg text-neutral-900">Reachability</h2>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          {!summary ? (
            <p className="text-body-sm text-neutral-500">Loading…</p>
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant={summary.reachability?.ok ? "success" : "error"} outline>
                {summary.reachability?.ok ? "Reachable" : "Unreachable"}
              </Badge>
              <p className="text-body-sm text-neutral-700">{summary.reachability?.message}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Totals</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total assets", value: summary?.totalAssets ?? "—" },
            { label: "Known size (uploads only)", value: summary ? formatBytes(summary.totalKnownBytes) : "—" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-label-sm text-neutral-500">{stat.label}</p>
              <p className="mt-1 text-heading-3 text-neutral-900">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-label-sm text-neutral-500">
          Only directly-uploaded assets currently record a file size — AI-generated assets don&apos;t probe their own
          output size today, so the known-size total is a lower bound, not the true bucket size.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-label-lg text-neutral-900">By kind</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2">Count</th>
                  <th className="px-4 py-2">Known size</th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.byKind.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                      {summary === null ? "Loading…" : "No assets yet."}
                    </td>
                  </tr>
                ) : (
                  summary.byKind.map((row) => (
                    <tr key={row.group} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-2">{row.group}</td>
                      <td className="px-4 py-2">{row.count}</td>
                      <td className="px-4 py-2 text-neutral-500">{formatBytes(row.totalBytes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-label-lg text-neutral-900">By source</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Count</th>
                  <th className="px-4 py-2">Known size</th>
                </tr>
              </thead>
              <tbody>
                {!summary || summary.bySource.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                      {summary === null ? "Loading…" : "No assets yet."}
                    </td>
                  </tr>
                ) : (
                  summary.bySource.map((row) => (
                    <tr key={row.group} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-2">{row.group}</td>
                      <td className="px-4 py-2">{row.count}</td>
                      <td className="px-4 py-2 text-neutral-500">{formatBytes(row.totalBytes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
