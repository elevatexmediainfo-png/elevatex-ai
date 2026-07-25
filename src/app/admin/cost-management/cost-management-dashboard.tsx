"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";

interface CostByProviderRow {
  category: string;
  providerId: string;
  requests: number;
  costUsd: number;
  avgLatencyMs: number;
  tokens: number;
  images: number;
  seconds: number;
}

interface CostByModelRow {
  category: string;
  providerId: string;
  model: string;
  requests: number;
  costUsd: number;
}

interface CostByProjectRow {
  videoProjectId: string;
  title: string;
  requests: number;
  costUsd: number;
}

interface CostByUserRow {
  userId: string;
  label: string;
  requests: number;
  costUsd: number;
}

interface CostBySubscriptionRow {
  planName: string;
  requests: number;
  costUsd: number;
}

interface CostManagementReport {
  totals: {
    requests: number;
    costUsd: number;
    tokens: number;
    images: number;
    voiceSeconds: number;
    videoSeconds: number;
  };
  byProvider: CostByProviderRow[];
  byModel: CostByModelRow[];
  byProject: CostByProjectRow[];
  byUser: CostByUserRow[];
  bySubscription: CostBySubscriptionRow[];
}

const WINDOWS = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
] as const;

function usd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function CostManagementDashboard() {
  const [hours, setHours] = React.useState<number>(24 * 30);
  const [report, setReport] = React.useState<CostManagementReport | null>(null);

  React.useEffect(() => {
    setReport(null);
    fetch(`/api/admin/cost-management?hours=${hours}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setReport(json.data.report);
      });
  }, [hours]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        {WINDOWS.map((w) => (
          <Button
            key={w.hours}
            type="button"
            size="sm"
            variant={hours === w.hours ? "primary" : "secondary"}
            onClick={() => setHours(w.hours)}
          >
            {w.label}
          </Button>
        ))}
      </div>

      {!report ? (
        <p className="text-body-sm text-neutral-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Requests" value={String(report.totals.requests)} />
            <Stat label="Total cost" value={usd(report.totals.costUsd)} />
            <Stat label="Tokens" value={report.totals.tokens.toLocaleString()} />
            <Stat label="Images" value={String(report.totals.images)} />
            <Stat label="Voice seconds" value={Math.round(report.totals.voiceSeconds).toLocaleString()} />
            <Stat label="Video seconds" value={Math.round(report.totals.videoSeconds).toLocaleString()} />
          </div>

          <Section title="By provider">
            <Table
              columns={["Category", "Provider", "Requests", "Avg latency", "Tokens", "Images", "Seconds", "Cost"]}
              rows={report.byProvider}
              empty="No generation activity in this window."
              render={(row) => [
                row.category,
                row.providerId,
                String(row.requests),
                `${row.avgLatencyMs} ms`,
                row.tokens.toLocaleString(),
                String(row.images),
                Math.round(row.seconds).toLocaleString(),
                usd(row.costUsd),
              ]}
            />
          </Section>

          <Section title="By model">
            <Table
              columns={["Category", "Provider", "Model", "Requests", "Cost"]}
              rows={report.byModel}
              empty="No model usage recorded in this window."
              render={(row) => [row.category, row.providerId, row.model, String(row.requests), usd(row.costUsd)]}
            />
          </Section>

          <Section title="By project (top 20)">
            <Table
              columns={["Project", "Requests", "Cost"]}
              rows={report.byProject}
              empty="No project-attributed activity in this window."
              render={(row) => [row.title, String(row.requests), usd(row.costUsd)]}
            />
          </Section>

          <Section title="By user (top 20)">
            <Table
              columns={["User", "Requests", "Cost"]}
              rows={report.byUser}
              empty="No user-attributed activity in this window."
              render={(row) => [row.label, String(row.requests), usd(row.costUsd)]}
            />
          </Section>

          <Section title="By subscription plan">
            <Table
              columns={["Plan", "Requests", "Cost"]}
              rows={report.bySubscription}
              empty="No subscription-attributed activity in this window."
              render={(row) => [row.planName, String(row.requests), usd(row.costUsd)]}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-label-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-heading-3 text-neutral-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-label-lg text-neutral-900">{title}</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">{children}</div>
    </div>
  );
}

function Table<T>({
  columns,
  rows,
  empty,
  render,
}: {
  columns: string[];
  rows: T[];
  empty: string;
  render: (row: T) => React.ReactNode[];
}) {
  return (
    <table className="w-full text-left text-body-sm">
      <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
        <tr>
          {columns.map((c) => (
            <th key={c} className="px-4 py-2">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-4 py-6 text-center text-neutral-500">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-0">
              {render(row).map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
