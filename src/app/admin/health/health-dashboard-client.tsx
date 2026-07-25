"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

interface HealthCheckResult {
  name: string;
  ok: boolean;
  message: string;
}

interface ProviderHealthRow {
  id: string;
  category: string;
  providerId: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  consecutiveFailures: number;
  lastError: string | null;
  updatedAt: string;
}

interface HealthDashboard {
  database: HealthCheckResult;
  redis: HealthCheckResult;
  storage: HealthCheckResult;
  queue: { pending: number; processing: number; paused: number; failedLast24h: number };
  providers: ProviderHealthRow[];
}

interface ErrorLogRow {
  id: string;
  requestId: string | null;
  route: string;
  message: string;
  createdAt: string;
}

const PROVIDER_STATUS_BADGE = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "error",
} as const;

function CheckCard({ check }: { check: HealthCheckResult | undefined }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-label-sm text-neutral-500">{check?.name ?? "—"}</p>
        {check && (
          <Badge variant={check.ok ? "success" : "error"} outline>
            {check.ok ? "OK" : "Down"}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-body-sm text-neutral-700">{check?.message ?? "Loading…"}</p>
    </div>
  );
}

export function HealthDashboardClient() {
  const [health, setHealth] = React.useState<HealthDashboard | null>(null);
  const [errors, setErrors] = React.useState<ErrorLogRow[] | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/health")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setHealth(json.data.health);
          setErrors(json.data.recentErrors);
        }
      });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-label-lg text-neutral-900">Infrastructure</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CheckCard check={health?.database} />
          <CheckCard check={health?.redis} />
          <CheckCard check={health?.storage} />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Queue</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pending", value: health?.queue.pending },
            { label: "Processing", value: health?.queue.processing },
            { label: "Paused", value: health?.queue.paused },
            { label: "Failed (24h)", value: health?.queue.failedLast24h },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-label-sm text-neutral-500">{stat.label}</p>
              <p className="mt-1 text-heading-3 text-neutral-900">{stat.value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">AI providers</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Consecutive failures</th>
                <th className="px-4 py-2">Last error</th>
              </tr>
            </thead>
            <tbody>
              {!health || health.providers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    {health === null ? "Loading…" : "No provider activity recorded yet."}
                  </td>
                </tr>
              ) : (
                health.providers.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.category}</td>
                    <td className="px-4 py-2">{row.providerId}</td>
                    <td className="px-4 py-2">
                      <Badge variant={PROVIDER_STATUS_BADGE[row.status]} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{row.consecutiveFailures}</td>
                    <td className="px-4 py-2 text-neutral-500">{row.lastError ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Recent errors</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          5xx-class application errors, captured even without Sentry configured — Sentry-additive when SENTRY_DSN is
          set.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Route/code</th>
                <th className="px-4 py-2">Message</th>
                <th className="px-4 py-2">Request ID</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {!errors || errors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    {errors === null ? "Loading…" : "No errors recorded."}
                  </td>
                </tr>
              ) : (
                errors.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.route}</td>
                    <td className="px-4 py-2 text-neutral-500">{row.message}</td>
                    <td className="px-4 py-2 text-neutral-500">{row.requestId ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(new Date(row.createdAt))}</td>
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
