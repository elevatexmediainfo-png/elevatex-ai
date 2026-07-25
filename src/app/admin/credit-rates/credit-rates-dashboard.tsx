"use client";

import * as React from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Unified view over every real place a user's credit balance actually gets
// charged. Investigated first (2026-07-24) rather than assumed centralized —
// there is no single source of truth, so this page aggregates 4 real,
// already-independently-editable sources through their EXISTING write paths
// (no schema change, no new table) instead of inventing a 5th storage
// mechanism. Deliberately excludes GENERATION_COST_RATES (lib/admin/config.ts)
// — that's our own internal USD vendor-cost tracking, a different concern
// from what gets deducted from a user's balance.

type MinimumTier = "BASIC" | "PRO" | "PREMIUM";

interface VideoActionCost {
  credits: number;
  minimumTier: MinimumTier;
}

interface TalkingHeadCosts {
  aiImageCredits: number;
  aiVideoCreditsPerSecond: number;
  exportCredits: number;
}

interface CreativeTool {
  id: string;
  key: string;
  label: string;
  pipeline: string;
  category: string;
  creditCostEstimate: number;
  enabled: boolean;
}

interface MarketingTemplate {
  id: string;
  name: string;
  outputType: "IMAGE" | "VIDEO";
  creditCost: number;
  isActive: boolean;
}

interface EnabledVideoProvider {
  providerId: string;
  label: string;
}

// Human labels for the VIDEO_ACTION_CREDIT_COSTS keys — same real actions
// documented in lib/admin/config.ts's own comments, surfaced here instead of
// showing raw snake_case keys to whoever's editing pricing.
const VIDEO_ACTION_LABELS: Record<string, string> = {
  animated_poster: "Animated Poster",
  veo_lite: "Quick Video (Veo Lite, 8s)",
  veo_standard: "Quick Video (Veo Standard, Premium)",
  veo_multiscene_ad: "Multi-Scene Ad — feature gate (per-scene charged via veo_lite)",
  film: "AI Film — storyboard / character variations / character sheet",
  film_scene: "AI Film — per-scene video render",
  ai_auto_edit: "AI Auto-Editor — precheck floor only (real charge is dynamic, see note below)",
};

async function patchConfig(key: string, value: unknown) {
  const res = await fetch("/api/admin/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Couldn't save.");
}

export function CreditRatesDashboard() {
  const [videoActions, setVideoActions] = React.useState<Record<string, VideoActionCost> | null>(null);
  const [talkingHead, setTalkingHead] = React.useState<TalkingHeadCosts | null>(null);
  const [tools, setTools] = React.useState<CreativeTool[] | null>(null);
  const [templates, setTemplates] = React.useState<MarketingTemplate[] | null>(null);
  const [videoProviderCosts, setVideoProviderCosts] = React.useState<Record<string, number> | null>(null);
  const [enabledVideoProviders, setEnabledVideoProviders] = React.useState<EnabledVideoProvider[] | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    const [configRes, toolsRes, templatesRes, providersRes] = await Promise.all([
      fetch("/api/admin/config").then((r) => r.json()),
      fetch("/api/admin/creative-tools").then((r) => r.json()),
      fetch("/api/admin/marketing-templates").then((r) => r.json()),
      fetch("/api/admin/ai-providers").then((r) => r.json()),
    ]);
    if (configRes.success) {
      setVideoActions(configRes.data.config.VIDEO_ACTION_CREDIT_COSTS.value);
      setTalkingHead(configRes.data.config.TALKING_HEAD_CREDIT_COSTS.value);
      setVideoProviderCosts(configRes.data.config.VIDEO_PROVIDER_CREDIT_COSTS.value);
    }
    if (toolsRes.success) setTools(toolsRes.data.tools);
    if (templatesRes.success) setTemplates(templatesRes.data.templates);
    if (providersRes.success) {
      // Real, live-queried enabled VIDEO providers — the same set the
      // user-facing provider selector shows (GET /api/videos/providers) —
      // "mock" excluded, never a real per-provider cost to set.
      const rows = (providersRes.data.providers as { category: string; providerId: string; label: string; enabled: boolean }[]).filter(
        (p) => p.category === "VIDEO" && p.enabled && p.providerId !== "mock"
      );
      setEnabledVideoProviders(rows.map((p) => ({ providerId: p.providerId, label: p.label })));
    }
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function saveVideoAction(actionKey: string, patch: Partial<VideoActionCost>) {
    if (!videoActions) return;
    const next = { ...videoActions, [actionKey]: { ...videoActions[actionKey], ...patch } };
    setSavingKey(`video:${actionKey}`);
    try {
      await patchConfig("VIDEO_ACTION_CREDIT_COSTS", next);
      setVideoActions(next);
      toast.success(`${VIDEO_ACTION_LABELS[actionKey] ?? actionKey} updated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveTalkingHead(patch: Partial<TalkingHeadCosts>) {
    if (!talkingHead) return;
    const next = { ...talkingHead, ...patch };
    setSavingKey("talking_head");
    try {
      await patchConfig("TALKING_HEAD_CREDIT_COSTS", next);
      setTalkingHead(next);
      toast.success("Talking Head credit costs updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveVideoProviderCost(providerId: string, credits: number | null) {
    if (!videoProviderCosts) return;
    const next = { ...videoProviderCosts };
    if (credits === null) {
      delete next[providerId];
    } else {
      next[providerId] = credits;
    }
    setSavingKey(`provider:${providerId}`);
    try {
      await patchConfig("VIDEO_PROVIDER_CREDIT_COSTS", next);
      setVideoProviderCosts(next);
      toast.success(`${providerId} updated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveTool(tool: CreativeTool, creditCostEstimate: number) {
    setSavingKey(`tool:${tool.id}`);
    try {
      const res = await fetch(`/api/admin/creative-tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditCostEstimate }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Couldn't save.");
      setTools((prev) => prev?.map((t) => (t.id === tool.id ? { ...t, creditCostEstimate } : t)) ?? prev);
      toast.success(`${tool.label} updated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveTemplate(template: MarketingTemplate, creditCost: number) {
    setSavingKey(`template:${template.id}`);
    try {
      const res = await fetch(`/api/admin/marketing-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditCost }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Couldn't save.");
      setTemplates((prev) => prev?.map((t) => (t.id === template.id ? { ...t, creditCost } : t)) ?? prev);
      toast.success(`${template.name} updated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSavingKey(null);
    }
  }

  if (!videoActions || !talkingHead || !tools || !templates || !videoProviderCosts || !enabledVideoProviders) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Video actions</h2>
        {Object.entries(videoActions).map(([actionKey, cost]) => (
          <div key={actionKey} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-label-md text-neutral-900">{VIDEO_ACTION_LABELS[actionKey] ?? actionKey}</p>
            {actionKey === "ai_auto_edit" && (
              <p className="mt-0.5 text-body-sm text-amber-600">
                This is only a precheck floor (blocks starting a job with an obviously empty balance) — the
                real charge is computed after the job completes, from its actual vendor cost. Editing this
                does not change what a user is actually charged.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-label-sm text-neutral-600">Credits</Label>
                <Input
                  type="number"
                  min={0}
                  defaultValue={cost.credits}
                  disabled={savingKey === `video:${actionKey}`}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value) && value !== cost.credits) saveVideoAction(actionKey, { credits: value });
                  }}
                />
              </div>
              <div>
                <Label className="text-label-sm text-neutral-600">Minimum tier</Label>
                <Select
                  value={cost.minimumTier}
                  onValueChange={(v) => saveVideoAction(actionKey, { minimumTier: v as MinimumTier })}
                  disabled={savingKey === `video:${actionKey}`}
                >
                  <SelectTrigger className="mt-1 h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basic</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="PREMIUM">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Video provider cost overrides</h2>
        <p className="text-body-sm text-neutral-500">
          For the user-facing video provider selector (Quick Video, GENERATED, AI Film, Marketing
          Templates VIDEO) — optionally charge a specific provider a different amount than its flow&apos;s
          normal cost above. Leave blank to use that flow&apos;s normal cost, same as today.
        </p>
        {enabledVideoProviders.length === 0 ? (
          <p className="text-body-sm text-neutral-400">No VIDEO providers are currently enabled.</p>
        ) : (
          enabledVideoProviders.map((provider) => (
            <div key={provider.providerId} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div>
                <p className="text-label-md text-neutral-900">{provider.label}</p>
                <p className="text-body-sm text-neutral-500">{provider.providerId}</p>
              </div>
              <div className="w-40">
                <Input
                  type="number"
                  min={0}
                  placeholder="Flow's normal cost"
                  defaultValue={videoProviderCosts[provider.providerId] ?? ""}
                  disabled={savingKey === `provider:${provider.providerId}`}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const current = videoProviderCosts[provider.providerId];
                    if (raw === "") {
                      if (current !== undefined) saveVideoProviderCost(provider.providerId, null);
                      return;
                    }
                    const value = Number(raw);
                    if (Number.isFinite(value) && value !== current) saveVideoProviderCost(provider.providerId, value);
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Talking Head</h2>
        <p className="text-body-sm text-neutral-500">
          Reusing an existing/brand/uploaded/stock asset is always free — these only charge for actual AI
          generation and export.
        </p>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-label-sm text-neutral-600">AI image credits</Label>
              <Input
                type="number"
                min={0}
                defaultValue={talkingHead.aiImageCredits}
                disabled={savingKey === "talking_head"}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== talkingHead.aiImageCredits) saveTalkingHead({ aiImageCredits: value });
                }}
              />
            </div>
            <div>
              <Label className="text-label-sm text-neutral-600">AI video credits / second</Label>
              <Input
                type="number"
                min={0}
                defaultValue={talkingHead.aiVideoCreditsPerSecond}
                disabled={savingKey === "talking_head"}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== talkingHead.aiVideoCreditsPerSecond)
                    saveTalkingHead({ aiVideoCreditsPerSecond: value });
                }}
              />
            </div>
            <div>
              <Label className="text-label-sm text-neutral-600">Export credits</Label>
              <Input
                type="number"
                min={0}
                defaultValue={talkingHead.exportCredits}
                disabled={savingKey === "talking_head"}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== talkingHead.exportCredits) saveTalkingHead({ exportCredits: value });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Creative tools</h2>
        <p className="text-body-sm text-neutral-500">
          Dashboard cards / quick actions (AI Image, Social Media, Brand Kit, etc.) — the same rows editable
          in full at Creative Tools; credit cost only, here.
        </p>
        {tools.map((tool) => (
          <div key={tool.id} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4">
            <div>
              <p className="text-label-md text-neutral-900">{tool.label}</p>
              <p className="text-body-sm text-neutral-500">
                {tool.pipeline} · {tool.category}
                {!tool.enabled && " · disabled"}
              </p>
            </div>
            <div className="w-28">
              <Input
                type="number"
                min={0}
                defaultValue={tool.creditCostEstimate}
                disabled={savingKey === `tool:${tool.id}`}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== tool.creditCostEstimate) saveTool(tool, value);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Marketing templates</h2>
        <p className="text-body-sm text-neutral-500">
          Same rows editable in full at Marketing Templates; credit cost only, here.
        </p>
        {templates.map((template) => (
          <div key={template.id} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4">
            <div>
              <p className="text-label-md text-neutral-900">{template.name}</p>
              <p className="text-body-sm text-neutral-500">
                {template.outputType}
                {!template.isActive && " · inactive"}
              </p>
            </div>
            <div className="w-28">
              <Input
                type="number"
                min={0}
                defaultValue={template.creditCost}
                disabled={savingKey === `template:${template.id}`}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value !== template.creditCost) saveTemplate(template, value);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
