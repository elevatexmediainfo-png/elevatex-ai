"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Category = "MAIN_CARD" | "QUICK_ACTION" | "COMING_SOON";
type Pipeline = "VIDEO" | "IMAGE" | "SOCIAL_MEDIA" | "MARKETING_CREATIVE" | "TALKING_HEAD" | "BRAND_ASSET" | "EXTERNAL";

interface CreativeTool {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string;
  gradientFrom: string | null;
  gradientTo: string | null;
  category: Category;
  pipeline: Pipeline;
  presetKey: string | null;
  routeOverride: string | null;
  creditCostEstimate: number;
  estimatedSeconds: number;
  promptTemplate: string | null;
  defaultProviderId: string | null;
  enabled: boolean;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<Category, string> = {
  MAIN_CARD: "Main Cards",
  QUICK_ACTION: "Quick Actions",
  COMING_SOON: "Coming Soon",
};

const CATEGORY_OPTIONS: Category[] = ["MAIN_CARD", "QUICK_ACTION", "COMING_SOON"];
const PIPELINE_OPTIONS: Pipeline[] = ["VIDEO", "IMAGE", "SOCIAL_MEDIA", "MARKETING_CREATIVE", "TALKING_HEAD", "BRAND_ASSET", "EXTERNAL"];

const emptyNewTool = {
  key: "",
  label: "",
  icon: "Sparkles",
  category: "MAIN_CARD" as Category,
  pipeline: "VIDEO" as Pipeline,
  creditCostEstimate: "1",
  estimatedSeconds: "30",
};

export function CreativeToolsManager() {
  const [tools, setTools] = React.useState<CreativeTool[] | null>(null);
  const [newTool, setNewTool] = React.useState(emptyNewTool);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    fetch("/api/admin/creative-tools")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setTools(json.data.tools);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function patchTool(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/creative-tools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save tool.");
      return;
    }
    load();
  }

  async function reorder(tool: CreativeTool, direction: "up" | "down") {
    if (!tools) return;
    const siblings = tools.filter((t) => t.category === tool.category).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((t) => t.id === tool.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= siblings.length) return;
    const other = siblings[swapIndex];
    await Promise.all([
      patchTool(tool.id, { sortOrder: other.sortOrder }),
      patchTool(other.id, { sortOrder: tool.sortOrder }),
    ]);
  }

  async function handleCreate() {
    const creditCostEstimate = Number(newTool.creditCostEstimate);
    const estimatedSeconds = Number(newTool.estimatedSeconds);
    if (!newTool.key.trim() || !newTool.label.trim() || !Number.isFinite(creditCostEstimate) || !Number.isFinite(estimatedSeconds)) {
      toast.error("Fill in a key, label, and numeric credit cost / estimated seconds.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/creative-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newTool.key.trim(),
          label: newTool.label.trim(),
          icon: newTool.icon.trim() || "Sparkles",
          category: newTool.category,
          pipeline: newTool.pipeline,
          creditCostEstimate,
          estimatedSeconds,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create tool.");
        return;
      }
      toast.success("Creative tool created.");
      setNewTool(emptyNewTool);
      load();
    } finally {
      setCreating(false);
    }
  }

  if (!tools) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {CATEGORY_OPTIONS.map((category) => {
        const rows = tools.filter((t) => t.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div key={category} className="flex flex-col gap-3">
            <h2 className="text-label-lg text-neutral-900">{CATEGORY_LABELS[category]}</h2>
            {rows.length === 0 ? (
              <p className="text-body-sm text-neutral-500">No tools in this category yet.</p>
            ) : (
              rows.map((tool, i) => (
                <div key={tool.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <Button type="button" variant="ghost" size="sm" className="h-5 px-1" disabled={i === 0} onClick={() => reorder(tool, "up")}>
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-5 px-1" disabled={i === rows.length - 1} onClick={() => reorder(tool, "down")}>
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>
                      <div>
                        <p className="text-label-md text-neutral-900">
                          {tool.label} <span className="text-body-sm text-neutral-400">({tool.key})</span>
                        </p>
                        <p className="text-body-sm text-neutral-500">{tool.pipeline} pipeline</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={tool.enabled ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => patchTool(tool.id, { enabled: !tool.enabled })}
                    >
                      {tool.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <Label className="text-label-sm text-neutral-600">Label</Label>
                      <Input
                        defaultValue={tool.label}
                        onBlur={(e) => {
                          if (e.target.value !== tool.label) patchTool(tool.id, { label: e.target.value });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-600">Icon (Lucide name)</Label>
                      <Input
                        defaultValue={tool.icon}
                        onBlur={(e) => {
                          if (e.target.value !== tool.icon) patchTool(tool.id, { icon: e.target.value });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-600">Credit cost</Label>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={tool.creditCostEstimate}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== tool.creditCostEstimate) patchTool(tool.id, { creditCostEstimate: value });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-600">Estimated seconds</Label>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={tool.estimatedSeconds}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== tool.estimatedSeconds) patchTool(tool.id, { estimatedSeconds: value });
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <Label className="text-label-sm text-neutral-600">Gradient from</Label>
                      <Input
                        defaultValue={tool.gradientFrom ?? ""}
                        placeholder="#6366f1"
                        onBlur={(e) => {
                          if (e.target.value !== (tool.gradientFrom ?? "")) patchTool(tool.id, { gradientFrom: e.target.value || null });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-600">Gradient to</Label>
                      <Input
                        defaultValue={tool.gradientTo ?? ""}
                        placeholder="#a855f7"
                        onBlur={(e) => {
                          if (e.target.value !== (tool.gradientTo ?? "")) patchTool(tool.id, { gradientTo: e.target.value || null });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-600">Route override</Label>
                      <Input
                        defaultValue={tool.routeOverride ?? ""}
                        placeholder="/create?objective=PROMOTION"
                        onBlur={(e) => {
                          if (e.target.value !== (tool.routeOverride ?? "")) patchTool(tool.id, { routeOverride: e.target.value || null });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-label-sm text-neutral-600">Default AI provider id</Label>
                      <Input
                        defaultValue={tool.defaultProviderId ?? ""}
                        placeholder="(category default)"
                        onBlur={(e) => {
                          if (e.target.value !== (tool.defaultProviderId ?? "")) patchTool(tool.id, { defaultProviderId: e.target.value || null });
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Label className="text-label-sm text-neutral-600">Description</Label>
                    <Input
                      defaultValue={tool.description ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (tool.description ?? "")) patchTool(tool.id, { description: e.target.value || null });
                      }}
                    />
                  </div>

                  <div className="mt-3">
                    <Label className="text-label-sm text-neutral-600">Prompt template (optional prefix)</Label>
                    <Textarea
                      rows={2}
                      defaultValue={tool.promptTemplate ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (tool.promptTemplate ?? "")) patchTool(tool.id, { promptTemplate: e.target.value || null });
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}

      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
        <p className="mb-3 text-label-md text-neutral-900">Add a creative tool</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input placeholder="Key (e.g. ai_avatar)" value={newTool.key} onChange={(e) => setNewTool((t) => ({ ...t, key: e.target.value }))} />
          <Input placeholder="Label" value={newTool.label} onChange={(e) => setNewTool((t) => ({ ...t, label: e.target.value }))} />
          <Input placeholder="Icon (Lucide name)" value={newTool.icon} onChange={(e) => setNewTool((t) => ({ ...t, icon: e.target.value }))} />
          <Select value={newTool.category} onValueChange={(v) => setNewTool((t) => ({ ...t, category: v as Category }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newTool.pipeline} onValueChange={(v) => setNewTool((t) => ({ ...t, pipeline: v as Pipeline }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Credit cost"
            value={newTool.creditCostEstimate}
            onChange={(e) => setNewTool((t) => ({ ...t, creditCostEstimate: e.target.value }))}
          />
          <Input
            type="number"
            placeholder="Estimated seconds"
            value={newTool.estimatedSeconds}
            onChange={(e) => setNewTool((t) => ({ ...t, estimatedSeconds: e.target.value }))}
          />
        </div>
        <Button type="button" variant="primary" size="sm" className="mt-3" disabled={creating} onClick={handleCreate}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add tool
        </Button>
        <p className="mt-2 text-body-sm text-neutral-500">
          New tools are <Badge variant="neutral" outline>disabled</Badge> by default in COMING_SOON-style pipelines until you wire a route —
          enable it once it&apos;s ready to appear on the Dashboard.
        </p>
      </div>
    </div>
  );
}
