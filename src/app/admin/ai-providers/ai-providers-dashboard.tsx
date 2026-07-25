"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

interface CatalogueEntry {
  category: string;
  providerId: string;
  label: string;
  requiresApiSecret: boolean;
  requiresExtraSecret: boolean;
  extraConfigFields: { key: string; label: string }[];
  apiKeyLabel?: string;
}

interface ProviderConfigSummary {
  category: string;
  providerId: string;
  label: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  hasApiSecret: boolean;
  apiSecretMasked: string | null;
  hasExtraSecret: boolean;
  model: string | null;
  defaultQuality: string | null;
  priority: number;
  monthlyBudgetUsd: number | null;
  dailyBudgetUsd: number | null;
  rateLimitPerMinute: number | null;
  timeoutMs: number | null;
  retryCount: number | null;
  extraConfig: Record<string, string> | null;
  keyExpiresAt: string | null;
  lastTestedAt: string | null;
  lastTestResult: boolean | null;
  lastTestError: string | null;
}

interface DashboardRow {
  category: string;
  providerId: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "NO_TRAFFIC" | "NOT_TRACKED";
  avgResponseMs: number | null;
  successRatePct: number | null;
  failureRatePct: number | null;
  todayRequests: number;
  todayCostUsd: number;
  monthlyCostUsd: number;
  lastError: string | null;
  healthScore: number | null;
  currentQueue: number | null;
}

interface AuditLogRow {
  id: string;
  category: string;
  providerId: string;
  action: string;
  performedBy: string | null;
  detail: unknown;
  createdAt: string;
}

const STATUS_BADGE: Record<DashboardRow["status"], BadgeVariant> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  DOWN: "error",
  NO_TRAFFIC: "neutral",
  NOT_TRACKED: "neutral",
};

const CATEGORY_ORDER = [
  "LLM",
  "IMAGE",
  "VOICE",
  "VIDEO",
  "STORAGE",
  "PAYMENT",
  "TRANSCRIPTION",
  "EMAIL",
  "STOCK_MEDIA",
  "ICON",
  "VIDEO_UNDERSTANDING",
  "REASONING",
];
const CATEGORY_LABEL: Record<string, string> = {
  LLM: "LLM (script generation)",
  IMAGE: "Image generation",
  VOICE: "Voice generation",
  VIDEO: "Video generation",
  STORAGE: "Storage",
  PAYMENT: "Payment",
  TRANSCRIPTION: "Transcription",
  EMAIL: "Email",
  // Milestone 26 — Admin Settings: stock media/icon search providers.
  STOCK_MEDIA: "Stock Media",
  ICON: "Icons",
  // Phase 12 Module 1 — AI Auto-Editor.
  VIDEO_UNDERSTANDING: "Video Understanding",
  REASONING: "Reasoning (editing decisions)",
};

function numOrEmpty(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseNullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface FormState {
  enabled: boolean;
  apiKey: string;
  apiKeyTouched: boolean;
  apiSecret: string;
  apiSecretTouched: boolean;
  extraSecret: string;
  extraSecretTouched: boolean;
  model: string;
  defaultQuality: string;
  priority: string;
  monthlyBudgetUsd: string;
  dailyBudgetUsd: string;
  rateLimitPerMinute: string;
  timeoutMs: string;
  retryCount: string;
  extraConfig: Record<string, string>;
  keyExpiresAt: string;
}

function formStateFrom(config: ProviderConfigSummary): FormState {
  return {
    enabled: config.enabled,
    apiKey: "",
    apiKeyTouched: false,
    apiSecret: "",
    apiSecretTouched: false,
    extraSecret: "",
    extraSecretTouched: false,
    model: config.model ?? "",
    defaultQuality: config.defaultQuality ?? "",
    priority: numOrEmpty(config.priority),
    monthlyBudgetUsd: numOrEmpty(config.monthlyBudgetUsd),
    dailyBudgetUsd: numOrEmpty(config.dailyBudgetUsd),
    rateLimitPerMinute: numOrEmpty(config.rateLimitPerMinute),
    timeoutMs: numOrEmpty(config.timeoutMs),
    retryCount: numOrEmpty(config.retryCount),
    extraConfig: { ...(config.extraConfig ?? {}) },
    keyExpiresAt: config.keyExpiresAt ? config.keyExpiresAt.slice(0, 10) : "",
  };
}

export function AIProvidersDashboard() {
  const [catalogue, setCatalogue] = React.useState<CatalogueEntry[] | null>(null);
  const [configs, setConfigs] = React.useState<Record<string, ProviderConfigSummary> | null>(null);
  const [dashboard, setDashboard] = React.useState<Record<string, DashboardRow> | null>(null);
  const [forms, setForms] = React.useState<Record<string, FormState>>({});
  const [logs, setLogs] = React.useState<AuditLogRow[] | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch("/api/admin/ai-providers")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) return;
        const providers: ProviderConfigSummary[] = json.data.providers;
        setCatalogue(json.data.catalogue);
        setConfigs(Object.fromEntries(providers.map((p) => [`${p.category}:${p.providerId}`, p])));
        setForms((prev) => {
          const next = { ...prev };
          for (const p of providers) {
            const key = `${p.category}:${p.providerId}`;
            if (!next[key]) next[key] = formStateFrom(p);
          }
          return next;
        });
      });
    fetch("/api/admin/ai-providers/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) return;
        const rows: DashboardRow[] = json.data.dashboard;
        setDashboard(Object.fromEntries(rows.map((r) => [`${r.category}:${r.providerId}`, r])));
      });
    fetch("/api/admin/ai-providers/logs?limit=30")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setLogs(json.data.logs);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function updateForm(key: string, patch: Partial<FormState>) {
    setForms((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save(entry: CatalogueEntry) {
    const key = `${entry.category}:${entry.providerId}`;
    const form = forms[key];
    if (!form) return;

    const body: Record<string, unknown> = {
      enabled: form.enabled,
      model: form.model || null,
      defaultQuality: form.defaultQuality || null,
      priority: parseNullableNumber(form.priority) ?? 0,
      monthlyBudgetUsd: parseNullableNumber(form.monthlyBudgetUsd),
      dailyBudgetUsd: parseNullableNumber(form.dailyBudgetUsd),
      rateLimitPerMinute: parseNullableNumber(form.rateLimitPerMinute),
      timeoutMs: parseNullableNumber(form.timeoutMs),
      retryCount: parseNullableNumber(form.retryCount),
      keyExpiresAt: form.keyExpiresAt || null,
    };
    if (entry.extraConfigFields.length > 0) body.extraConfig = form.extraConfig;
    // Secrets are only sent when the admin actually typed something (or
    // explicitly cleared the field) — this is what lets re-saving the rest
    // of the form leave an already-saved key untouched.
    if (form.apiKeyTouched) body.apiKey = form.apiKey;
    if (form.apiSecretTouched) body.apiSecret = form.apiSecret;
    if (form.extraSecretTouched) body.extraSecret = form.extraSecret;

    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/ai-providers/${entry.category}/${entry.providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save.");
        return;
      }
      const updated: ProviderConfigSummary = json.data.provider;
      setConfigs((prev) => ({ ...prev, [key]: updated }));
      setForms((prev) => ({ ...prev, [key]: formStateFrom(updated) }));
      toast.success(`${entry.label} saved.`);
      load();
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function testConnection(entry: CatalogueEntry) {
    const key = `${entry.category}:${entry.providerId}`;
    setBusyKey(`${key}:test`);
    try {
      const res = await fetch(`/api/admin/ai-providers/${entry.category}/${entry.providerId}/test`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Test failed.");
        return;
      }
      const result = json.data.result as { ok: boolean; message: string };
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      load();
    } catch {
      toast.error("Couldn't test connection. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  if (!catalogue || !configs) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    entries: catalogue.filter((e) => e.category === category),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {byCategory.map(({ category, entries }) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-label-lg text-neutral-900">{CATEGORY_LABEL[category] ?? category}</h2>
          <div className="flex flex-col gap-4">
            {entries.map((entry) => {
              const key = `${entry.category}:${entry.providerId}`;
              const config = configs[key];
              const dash = dashboard?.[key];
              const form = forms[key];
              if (!config || !form) return null;
              const saving = busyKey === key;
              const testing = busyKey === `${key}:test`;

              return (
                <div key={key} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="flex items-center gap-2 text-label-md text-neutral-900">
                        <input
                          type="checkbox"
                          checked={form.enabled}
                          onChange={(e) => updateForm(key, { enabled: e.target.checked })}
                          className="size-4"
                        />
                        {entry.label}
                      </Label>
                      {dash && (
                        <Badge variant={STATUS_BADGE[dash.status]} outline>
                          {dash.status.replace("_", " ")}
                        </Badge>
                      )}
                      {dash?.healthScore !== null && dash?.healthScore !== undefined && (
                        <span className="text-body-sm text-neutral-500">Health {dash.healthScore}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        loading={testing}
                        disabled={testing || saving}
                        onClick={() => testConnection(entry)}
                      >
                        Test Connection
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        type="button"
                        loading={saving}
                        disabled={testing || saving}
                        onClick={() => save(entry)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  {dash && dash.status !== "NOT_TRACKED" && (
                    <div className="mt-3 flex flex-wrap gap-4 text-body-sm text-neutral-500">
                      <span>Today: {dash.todayRequests} requests</span>
                      <span>Today&apos;s cost: ${dash.todayCostUsd.toFixed(4)}</span>
                      <span>Monthly cost: ${dash.monthlyCostUsd.toFixed(4)}</span>
                      <span>Avg latency: {dash.avgResponseMs !== null ? `${dash.avgResponseMs} ms` : "—"}</span>
                      <span>
                        Success/Failure:{" "}
                        {dash.successRatePct !== null
                          ? `${dash.successRatePct.toFixed(0)}% / ${dash.failureRatePct?.toFixed(0)}%`
                          : "—"}
                      </span>
                      {dash.currentQueue !== null && <span>Queue: {dash.currentQueue}</span>}
                    </div>
                  )}
                  {dash?.lastError && (
                    <p className="mt-1 text-body-sm text-error">Last error: {dash.lastError}</p>
                  )}

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <Label className="text-label-sm text-neutral-700">{entry.apiKeyLabel ?? "API Key"}</Label>
                      <Input
                        type="password"
                        value={form.apiKeyTouched ? form.apiKey : ""}
                        placeholder={config.apiKeyMasked ?? "Not set"}
                        onChange={(e) => updateForm(key, { apiKey: e.target.value, apiKeyTouched: true })}
                        className="mt-1"
                      />
                    </div>
                    {entry.requiresApiSecret && (
                      <div>
                        <Label className="text-label-sm text-neutral-700">API Secret</Label>
                        <Input
                          type="password"
                          value={form.apiSecretTouched ? form.apiSecret : ""}
                          placeholder={config.apiSecretMasked ?? "Not set"}
                          onChange={(e) => updateForm(key, { apiSecret: e.target.value, apiSecretTouched: true })}
                          className="mt-1"
                        />
                      </div>
                    )}
                    {entry.requiresExtraSecret && (
                      <div>
                        <Label className="text-label-sm text-neutral-700">Webhook Secret</Label>
                        <Input
                          type="password"
                          value={form.extraSecretTouched ? form.extraSecret : ""}
                          placeholder={config.hasExtraSecret ? "••••••••" : "Not set"}
                          onChange={(e) => updateForm(key, { extraSecret: e.target.value, extraSecretTouched: true })}
                          className="mt-1"
                        />
                      </div>
                    )}
                    <div>
                      <Label className="text-label-sm text-neutral-700">Model</Label>
                      <Input
                        value={form.model}
                        onChange={(e) => updateForm(key, { model: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Default quality</Label>
                      <Input
                        value={form.defaultQuality}
                        onChange={(e) => updateForm(key, { defaultQuality: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Priority (lower = tried first)</Label>
                      <Input
                        type="number"
                        value={form.priority}
                        onChange={(e) => updateForm(key, { priority: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Monthly budget (USD)</Label>
                      <Input
                        type="number"
                        value={form.monthlyBudgetUsd}
                        placeholder="No limit"
                        onChange={(e) => updateForm(key, { monthlyBudgetUsd: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Daily budget (USD)</Label>
                      <Input
                        type="number"
                        value={form.dailyBudgetUsd}
                        placeholder="No limit"
                        onChange={(e) => updateForm(key, { dailyBudgetUsd: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Rate limit (req/min)</Label>
                      <Input
                        type="number"
                        value={form.rateLimitPerMinute}
                        placeholder="No limit"
                        onChange={(e) => updateForm(key, { rateLimitPerMinute: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Timeout (ms)</Label>
                      <Input
                        type="number"
                        value={form.timeoutMs}
                        placeholder="Category default"
                        onChange={(e) => updateForm(key, { timeoutMs: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Retry count</Label>
                      <Input
                        type="number"
                        value={form.retryCount}
                        placeholder="Category default"
                        onChange={(e) => updateForm(key, { retryCount: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-700">Key expires</Label>
                      <Input
                        type="date"
                        value={form.keyExpiresAt}
                        onChange={(e) => updateForm(key, { keyExpiresAt: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    {entry.extraConfigFields.map((field) => (
                      <div key={field.key}>
                        <Label className="text-label-sm text-neutral-700">{field.label}</Label>
                        <Input
                          value={form.extraConfig[field.key] ?? ""}
                          onChange={(e) =>
                            updateForm(key, { extraConfig: { ...form.extraConfig, [field.key]: e.target.value } })
                          }
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>

                  {config.keyExpiresAt && new Date(config.keyExpiresAt).getTime() < Date.now() + 7 * 86_400_000 && (
                    <p className="mt-2 text-body-sm text-warning">
                      Key expires {formatDateTime(new Date(config.keyExpiresAt))} — rotate it soon.
                    </p>
                  )}
                  {config.lastTestedAt && (
                    <p className="mt-2 text-body-sm text-neutral-500">
                      Last tested {formatDateTime(new Date(config.lastTestedAt))} —{" "}
                      {config.lastTestResult ? "OK" : `failed: ${config.lastTestError}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h2 className="text-label-lg text-neutral-900">Audit log</h2>
        <p className="mt-1 text-body-sm text-neutral-500">Every provider config change and connection test.</p>
        <div className="mt-3 flex flex-col gap-2">
          {!logs || logs.length === 0 ? (
            <p className="text-body-sm text-neutral-500">{logs === null ? "Loading…" : "No activity yet."}</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-body-sm">
                <span className="font-mono text-neutral-700">
                  {log.category}:{log.providerId}
                </span>{" "}
                <span className="text-neutral-500">
                  {log.action} · {formatDateTime(new Date(log.createdAt))}
                  {log.performedBy ? ` · by ${log.performedBy}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
