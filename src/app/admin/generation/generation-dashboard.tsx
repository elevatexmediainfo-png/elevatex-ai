"use client";

import * as React from "react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { AdminConfigForm } from "@/components/admin/admin-config-form";
import { formatDateTime } from "@/lib/format";

interface HealthRow {
  id: string;
  category: string;
  providerId: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  downUntil: string | null;
}

interface UsageRow {
  category: string;
  providerId: string;
  status: "SUCCESS" | "FAILURE";
  count: number;
  avgLatencyMs: number | null;
  totalCostUsd: number | null;
}

interface FailureRow {
  id: string;
  category: string;
  providerId: string;
  operation: string;
  errorMessage: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<HealthRow["status"], BadgeVariant> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "error",
};

// Provider health + usage analytics are read-only, fetched on mount — unlike
// AdminConfigForm there's nothing here to PATCH, so no save plumbing. The
// retry/timeout/health/cost-rate policy itself IS editable, via the generic
// AdminConfigForm against the "generation_policy" config category.
export function GenerationDashboard() {
  const [health, setHealth] = React.useState<HealthRow[] | null>(null);
  const [usage, setUsage] = React.useState<UsageRow[] | null>(null);
  const [failures, setFailures] = React.useState<FailureRow[] | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/generation/health")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHealth(json.data.health);
      });
    fetch("/api/admin/generation/analytics?hours=24")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setUsage(json.data.usage);
          setFailures(json.data.recentFailures);
        }
      });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-body-sm text-neutral-500">
          Applies to every category — provider selection/priority stays on the Providers tab.
        </p>
        <div className="mt-3">
          <AdminConfigForm
            sections={[{ category: "generation_policy", title: "Retry, timeout & cost policy" }]}
          />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Provider health</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Circuit-breaker state per provider — DOWN providers are skipped until their cooldown passes.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Consecutive failures</th>
                <th className="px-4 py-2">Last success</th>
                <th className="px-4 py-2">Last failure</th>
              </tr>
            </thead>
            <tbody>
              {!health || health.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                    {health === null ? "Loading…" : "No generation attempts recorded yet."}
                  </td>
                </tr>
              ) : (
                health.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.category}</td>
                    <td className="px-4 py-2 font-mono">{row.providerId}</td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_BADGE[row.status]} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{row.consecutiveFailures}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {row.lastSuccessAt ? formatDateTime(new Date(row.lastSuccessAt)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">
                      {row.lastFailureAt ? formatDateTime(new Date(row.lastFailureAt)) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Usage analytics (last 24h)</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Per-provider attempt counts, average latency, and estimated vendor cost (not user-facing pricing).
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Avg latency</th>
                <th className="px-4 py-2">Total cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {!usage || usage.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                    {usage === null ? "Loading…" : "No generation activity in this window."}
                  </td>
                </tr>
              ) : (
                usage.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.category}</td>
                    <td className="px-4 py-2 font-mono">{row.providerId}</td>
                    <td className="px-4 py-2">
                      <Badge variant={row.status === "SUCCESS" ? "success" : "error"} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{row.count}</td>
                    <td className="px-4 py-2">
                      {row.avgLatencyMs ? `${Math.round(row.avgLatencyMs)} ms` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {row.totalCostUsd ? `$${row.totalCostUsd.toFixed(4)}` : "$0"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {failures && failures.length > 0 && (
        <div>
          <h2 className="text-label-lg text-neutral-900">Recent failures</h2>
          <div className="mt-3 flex flex-col gap-2">
            {failures.map((f) => (
              <div key={f.id} className="rounded-lg border border-error/30 bg-error-light px-4 py-3">
                <p className="text-label-sm text-error">
                  {f.category} · {f.providerId} · {f.operation}
                </p>
                <p className="mt-0.5 text-body-sm text-neutral-700">{f.errorMessage}</p>
                <p className="mt-0.5 text-body-sm text-neutral-500">{formatDateTime(new Date(f.createdAt))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
