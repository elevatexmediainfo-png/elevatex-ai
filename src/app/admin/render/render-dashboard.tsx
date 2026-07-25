"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminConfigForm } from "@/components/admin/admin-config-form";
import { formatDateTime } from "@/lib/format";

interface QueueSnapshot {
  pending: number;
  processing: number;
  paused: number;
  failedLast24h: number;
}

interface SceneRenderStats {
  windowHours: number;
  totalScenes: number;
  completed: number;
  failed: number;
  avgAttempts: number;
  avgRenderSeconds: number | null;
}

interface HistoryRow {
  id: string;
  videoProjectId: string;
  sceneId: string | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED" | "CANCELLED";
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_BADGE: Record<HistoryRow["status"], BadgeVariant> = {
  PENDING: "neutral",
  PROCESSING: "info",
  COMPLETED: "success",
  FAILED: "error",
  PAUSED: "warning",
  CANCELLED: "neutral",
};

interface DeadLetterRow {
  id: string;
  videoProjectId: string;
  sceneId: string | null;
  payload: { kind?: string };
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobLatencyPercentiles {
  windowHours: number;
  sampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

interface QueueThroughputBucket {
  hourStart: string;
  completed: number;
  failed: number;
}

// Queue depth/scene stats and history are read-only, fetched on mount —
// concurrency/retry/default-prompt policy is editable via the generic
// AdminConfigForm against the "render_policy" config category, same pattern
// as /admin/generation's "generation_policy" panel.
export function RenderDashboard() {
  const [queue, setQueue] = React.useState<QueueSnapshot | null>(null);
  const [sceneStats, setSceneStats] = React.useState<SceneRenderStats | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[] | null>(null);
  const [deadLetter, setDeadLetter] = React.useState<DeadLetterRow[] | null>(null);
  const [latency, setLatency] = React.useState<JobLatencyPercentiles | null>(null);
  const [throughput, setThroughput] = React.useState<QueueThroughputBucket[] | null>(null);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const loadDeadLetter = React.useCallback(() => {
    fetch("/api/admin/render/dead-letter")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDeadLetter(json.data.jobs);
      });
  }, []);

  React.useEffect(() => {
    fetch("/api/admin/render/queue?hours=24")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setQueue(json.data.queue);
          setSceneStats(json.data.sceneStats);
        }
      });
    fetch("/api/admin/render/history?limit=50")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHistory(json.data.history);
      });
    fetch("/api/admin/render/metrics?hours=24")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setLatency(json.data.latency);
          setThroughput(json.data.throughput);
        }
      });
    loadDeadLetter();
  }, [loadDeadLetter]);

  async function handleRetry(jobId: string) {
    setRetryingId(jobId);
    try {
      const res = await fetch(`/api/admin/render/dead-letter/${jobId}/retry`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't retry this job.");
        return;
      }
      toast.success("Job re-queued.");
      loadDeadLetter();
    } finally {
      setRetryingId(null);
    }
  }

  const totalCompleted24h = throughput?.reduce((sum, b) => sum + b.completed, 0) ?? null;
  const totalFailed24h = throughput?.reduce((sum, b) => sum + b.failed, 0) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-body-sm text-neutral-500">
          Worker concurrency, retry attempts, and per-scene defaults — applies to every new render run.
        </p>
        <div className="mt-3">
          <AdminConfigForm sections={[{ category: "render_policy", title: "Render queue & scene defaults" }]} />
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Queue</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pending", value: queue?.pending },
            { label: "Processing", value: queue?.processing },
            { label: "Paused", value: queue?.paused },
            { label: "Failed (24h)", value: queue?.failedLast24h },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-label-sm text-neutral-500">{stat.label}</p>
              <p className="mt-1 text-heading-3 text-neutral-900">{stat.value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Rendering analytics ({sceneStats?.windowHours ?? 24}h)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Scenes touched", value: sceneStats?.totalScenes },
            { label: "Completed", value: sceneStats?.completed },
            { label: "Failed", value: sceneStats?.failed },
            {
              label: "Avg render time",
              value: sceneStats?.avgRenderSeconds != null ? `${Math.round(sceneStats.avgRenderSeconds)}s` : "—",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-label-sm text-neutral-500">{stat.label}</p>
              <p className="mt-1 text-heading-3 text-neutral-900">{stat.value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Queue metrics (24h)</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Completed (24h)", value: totalCompleted24h },
            { label: "Failed (24h)", value: totalFailed24h },
            { label: "p50 latency", value: latency?.p50Ms != null ? `${Math.round(latency.p50Ms / 1000)}s` : "—" },
            { label: "p95 latency", value: latency?.p95Ms != null ? `${Math.round(latency.p95Ms / 1000)}s` : "—" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-label-sm text-neutral-500">{stat.label}</p>
              <p className="mt-1 text-heading-3 text-neutral-900">{stat.value ?? "—"}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-label-sm text-neutral-500">
          Latency is claim-to-complete processing time ({latency?.sampleSize ?? 0} completed jobs sampled), not queue
          wait time.
        </p>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Dead letter</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Jobs that exhausted every retry attempt and were marked permanently FAILED — retry resets the attempt
          budget and re-queues through the same claim mechanics as any other job.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Error</th>
                <th className="px-4 py-2">Failed at</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!deadLetter || deadLetter.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    {deadLetter === null ? "Loading…" : "No permanently failed jobs."}
                  </td>
                </tr>
              ) : (
                deadLetter.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.sceneId ? "Scene" : row.payload?.kind ?? "Merge"}</td>
                    <td className="px-4 py-2">
                      {row.attempts}/{row.maxAttempts}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{row.errorMessage ?? "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(new Date(row.updatedAt))}</td>
                    <td className="px-4 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={retryingId === row.id}
                        onClick={() => handleRetry(row.id)}
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">Render history</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Most recent 50 jobs — scene renders and merges, both flow through the same queue.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
              <tr>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Completed</th>
                <th className="px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {!history || history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                    {history === null ? "Loading…" : "No render jobs yet."}
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">{row.sceneId ? "Scene" : "Merge"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_BADGE[row.status]} outline>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {row.attempts}/{row.maxAttempts}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{formatDateTime(new Date(row.createdAt))}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {row.completedAt ? formatDateTime(new Date(row.completedAt)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{row.errorMessage ?? "—"}</td>
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
