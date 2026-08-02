"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";
import { cn } from "@/lib/utils";

type OutputType = "IMAGE" | "VIDEO";
type AspectRatio = "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
type AssetRole = "STYLE" | "COMPOSITION" | "LIGHTING" | "COLOR" | "TYPOGRAPHY" | "BRANDING";

const ASSET_ROLE_OPTIONS: AssetRole[] = ["STYLE", "COMPOSITION", "LIGHTING", "COLOR", "TYPOGRAPHY", "BRANDING"];
const ASSET_ROLE_LABELS: Record<AssetRole, string> = {
  STYLE: "Style",
  COMPOSITION: "Composition",
  LIGHTING: "Lighting",
  COLOR: "Color",
  TYPOGRAPHY: "Typography",
  BRANDING: "Branding",
};
const NO_ROLE = "__none__";
const NO_FALLBACK = "__none__";
const OUTPUT_TYPE_OPTIONS: OutputType[] = ["IMAGE", "VIDEO"];

interface ProviderOption {
  id: string;
  label: string;
}

interface ReferenceAsset {
  assetId: string;
  role: AssetRole | null;
  asset: { id: string; storageKey: string; mimeType: string | null };
}

interface MarketingTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  outputType: OutputType;
  aspectRatio: AspectRatio;
  referenceAssets: ReferenceAsset[];
  promptTemplate: string;
  primaryProviderId: string | null;
  fallbackProviderId: string | null;
  userAssetRequired: boolean;
  creditCost: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  updatedAt: string;
  _count: { generations: number };
}

const emptyNewTemplate = {
  name: "",
  category: "",
  outputType: "IMAGE" as OutputType,
  aspectRatio: "RATIO_1_1" as AspectRatio,
};

// Everything editable directly on this one page (2026-08-04, reversing the
// earlier dedicated-editor-route attempt per explicit founder instruction:
// "I do NOT want a second page or hidden editor" / "exactly like the
// existing Templates admin") — every field for every template is always
// rendered, in full, right here. No accordion/expand-collapse toggle, no
// navigation, no separate route — matching src/app/admin/templates/
// templates-manager.tsx's own "one flat page, per-field onBlur/onChange
// auto-save" convention exactly, just with this feature's own richer field
// set (Prompt Template, Primary/Fallback Provider, User Asset Required,
// ordered multi-asset Reference Assets) instead of that page's simpler one.
export function MarketingTemplatesManager() {
  const [templates, setTemplates] = React.useState<MarketingTemplate[] | null>(null);
  const [newTemplate, setNewTemplate] = React.useState(emptyNewTemplate);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const [providersByType, setProvidersByType] = React.useState<Record<OutputType, ProviderOption[]>>({ IMAGE: [], VIDEO: [] });
  const cardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const promptRefs = React.useRef<Map<string, HTMLTextAreaElement>>(new Map());
  // Set right when a template is created, before `load()` refreshes
  // `templates` — the effect below watches for the corresponding card to
  // actually exist (its ref attaches once React commits it), so the
  // scroll/highlight/focus fires exactly once the new card is real — no
  // navigation anywhere, the card is already on this same page.
  const pendingFocusId = React.useRef<string | null>(null);

  // Real bug fix (2026-08-04) — this used to have no error handling at
  // all: a failed refresh (a transient error, a non-JSON/HTML error
  // response, `json.success === false`) simply did nothing — no toast, no
  // retry, and `templates` state was left exactly as it was. Since this
  // is called again after every create/patch/delete, a silently-failed
  // post-create refresh looked identical to "nothing was created" (the
  // page stays on whatever `templates` already held, which right after a
  // fresh empty page load is `[]`) even though the POST itself succeeded.
  const load = React.useCallback(() => {
    fetch("/api/admin/marketing-templates")
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!json || !json.success) {
          toast.error(json?.error?.message ?? "Couldn't load marketing templates. Please refresh the page.");
          return;
        }
        setTemplates(json.data.templates);
      })
      .catch(() => {
        toast.error("Network error while loading marketing templates. Please refresh the page.");
      });
  }, []);

  React.useEffect(() => {
    load();
    (["IMAGE", "VIDEO"] as OutputType[]).forEach((outputType) => {
      fetch(`/api/admin/marketing-templates/providers?outputType=${outputType}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setProvidersByType((prev) => ({ ...prev, [outputType]: json.data.providers }));
        });
    });
  }, [load]);

  React.useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    const card = cardRefs.current.get(id);
    if (!card) return;
    pendingFocusId.current = null;

    card.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedId(id);
    promptRefs.current.get(id)?.focus();

    const timer = setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current));
    }, 2500);
    return () => clearTimeout(timer);
  }, [templates]);

  async function patchTemplate(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/marketing-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save template.");
      return;
    }
    load();
  }

  async function deleteTemplate(template: MarketingTemplate) {
    setDeletingId(template.id);
    try {
      const res = await fetch(`/api/admin/marketing-templates/${template.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't delete template.");
        return;
      }
      toast.success("Template deleted.");
      load();
    } finally {
      setDeletingId(null);
    }
  }

  // Reference-asset management — full-replace PUT, optimistic-concurrency-
  // guarded via template.updatedAt (Production Hardening, 2026-08-03).
  function asOrderList(template: MarketingTemplate): { assetId: string; role: AssetRole | null }[] {
    return template.referenceAssets.map((r) => ({ assetId: r.assetId, role: r.role }));
  }

  async function replaceReferenceAssets(template: MarketingTemplate, assets: { assetId: string; role: AssetRole | null }[]) {
    const res = await fetch(`/api/admin/marketing-templates/${template.id}/assets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedUpdatedAt: template.updatedAt, assets }),
    });
    const json = await res.json();
    if (!json.success) {
      if (json.error?.code === "ERR_CONFLICT") {
        toast.error("Someone else changed this template. Reloading the latest version.");
        load();
        return;
      }
      toast.error(json.error?.message ?? "Couldn't update reference assets.");
      return;
    }
    load();
  }

  async function uploadAndAttachReferenceAsset(template: MarketingTemplate, file: File) {
    setUploadingId(template.id);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/marketing-templates/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't upload reference asset.");
        return;
      }
      await replaceReferenceAssets(template, [...asOrderList(template), { assetId: json.data.asset.id, role: null }]);
    } finally {
      setUploadingId(null);
    }
  }

  function removeReferenceAsset(template: MarketingTemplate, assetId: string) {
    void replaceReferenceAssets(
      template,
      asOrderList(template).filter((a) => a.assetId !== assetId)
    );
  }

  function setReferenceAssetRole(template: MarketingTemplate, assetId: string, role: AssetRole | null) {
    void replaceReferenceAssets(
      template,
      asOrderList(template).map((a) => (a.assetId === assetId ? { ...a, role } : a))
    );
  }

  function moveReferenceAsset(template: MarketingTemplate, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= template.referenceAssets.length) return;
    const list = asOrderList(template);
    [list[index], list[target]] = [list[target], list[index]];
    void replaceReferenceAssets(template, list);
  }

  async function handleCreate() {
    if (!newTemplate.name.trim()) {
      toast.error("A name is required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/marketing-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplate.name.trim(),
          category: newTemplate.category.trim() || null,
          outputType: newTemplate.outputType,
          aspectRatio: newTemplate.aspectRatio,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create template.");
        return;
      }
      toast.success("Template created. Fill in the Prompt Template and Primary Provider below.");
      pendingFocusId.current = json.data.template.id;
      setNewTemplate(emptyNewTemplate);
      load();
    } finally {
      setCreating(false);
    }
  }

  if (!templates) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {templates.length === 0 ? (
        <p className="text-body-sm text-neutral-500">No marketing templates yet.</p>
      ) : (
        templates
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((template) => {
            const isReady = Boolean(template.primaryProviderId) && template.promptTemplate.trim().length > 0;
            const providerOptions = providersByType[template.outputType];
            return (
              <div
                key={template.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(template.id, el);
                  else cardRefs.current.delete(template.id);
                }}
                className={cn(
                  "rounded-xl border border-neutral-200 bg-white p-4 transition-colors duration-300",
                  highlightedId === template.id && "border-amber-400 ring-2 ring-amber-200"
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-label-md text-neutral-900">{template.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={isReady ? "success" : "warning"} outline>
                        {isReady ? "Ready" : "Not browsable yet — needs a Prompt Template + Primary Provider"}
                      </Badge>
                      <Badge variant="neutral" outline>
                        {template.outputType}
                      </Badge>
                      {template._count.generations > 0 && (
                        <Badge variant="neutral" outline>
                          {template._count.generations} generation{template._count.generations === 1 ? "" : "s"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={template.isActive ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => patchTemplate(template.id, { isActive: !template.isActive })}
                    >
                      {template.isActive ? "Active" : "Inactive"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={deletingId === template.id}
                      title={template._count.generations > 0 ? "Disable instead — real generations exist" : "Delete"}
                      onClick={() => deleteTemplate(template)}
                    >
                      {deletingId === template.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <Label className="text-label-sm text-neutral-600">Name</Label>
                    <Input
                      defaultValue={template.name}
                      onBlur={(e) => {
                        if (e.target.value !== template.name) patchTemplate(template.id, { name: e.target.value });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-label-sm text-neutral-600">Category</Label>
                    <Input
                      defaultValue={template.category ?? ""}
                      placeholder="e.g. Product Launch"
                      onBlur={(e) => {
                        if (e.target.value !== (template.category ?? "")) patchTemplate(template.id, { category: e.target.value || null });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-label-sm text-neutral-600">Output type</Label>
                    <Select
                      value={template.outputType}
                      onValueChange={(v) => {
                        const nextOutputType = v as OutputType;
                        const stillValid = ASPECT_RATIOS_BY_OUTPUT_TYPE[nextOutputType].includes(template.aspectRatio);
                        patchTemplate(template.id, {
                          outputType: nextOutputType,
                          ...(stillValid ? {} : { aspectRatio: ASPECT_RATIOS_BY_OUTPUT_TYPE[nextOutputType][0] }),
                        });
                      }}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-label-sm text-neutral-600">Aspect ratio</Label>
                    <Select value={template.aspectRatio} onValueChange={(v) => patchTemplate(template.id, { aspectRatio: v })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS_BY_OUTPUT_TYPE[template.outputType].map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <Label className="text-label-sm text-neutral-600">Credit cost</Label>
                    <Input
                      type="number"
                      min={0}
                      defaultValue={template.creditCost}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== template.creditCost) patchTemplate(template.id, { creditCost: value });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-label-sm text-neutral-600">Primary Provider</Label>
                    <Select
                      value={template.primaryProviderId ?? undefined}
                      onValueChange={(v) => patchTemplate(template.id, { primaryProviderId: v })}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Choose a provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-label-sm text-neutral-600">Fallback Provider</Label>
                    <Select
                      value={template.fallbackProviderId ?? NO_FALLBACK}
                      onValueChange={(v) => patchTemplate(template.id, { fallbackProviderId: v === NO_FALLBACK ? null : v })}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_FALLBACK}>None</SelectItem>
                        {providerOptions
                          .filter((p) => p.id !== template.primaryProviderId)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-1.5">
                    <Checkbox
                      checked={template.userAssetRequired}
                      onCheckedChange={(v) => patchTemplate(template.id, { userAssetRequired: Boolean(v) })}
                    />
                    <Label className="text-label-sm text-neutral-600">User Asset Required</Label>
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-label-sm text-neutral-600">Ordered Reference Assets (optional)</Label>
                  <div className="flex flex-col gap-1.5">
                    {template.referenceAssets.map((ref, index) => (
                      <div key={ref.assetId} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-500">{ref.asset.mimeType ?? ref.assetId}</span>
                        <Select
                          value={ref.role ?? NO_ROLE}
                          onValueChange={(v) => setReferenceAssetRole(template, ref.assetId, v === NO_ROLE ? null : (v as AssetRole))}
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_ROLE}>No role</SelectItem>
                            {ASSET_ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ASSET_ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === 0}
                          onClick={() => moveReferenceAsset(template, index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === template.referenceAssets.length - 1}
                          onClick={() => moveReferenceAsset(template, index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeReferenceAsset(template, ref.assetId)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-label-sm text-neutral-600">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadAndAttachReferenceAsset(template, file);
                          e.target.value = "";
                        }}
                      />
                      {uploadingId === template.id ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
                      Add reference asset
                    </label>
                  </div>
                </div>

                <div className="mt-3">
                  <Label className="text-label-sm text-neutral-600">Description</Label>
                  <Input
                    defaultValue={template.description ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (template.description ?? "")) patchTemplate(template.id, { description: e.target.value || null });
                    }}
                  />
                </div>

                <div className="mt-3">
                  <Label className="text-label-sm text-neutral-600">
                    Prompt Template — a complete, production-quality prompt. Users never see or edit this.
                  </Label>
                  <Textarea
                    ref={(el) => {
                      if (el) promptRefs.current.set(template.id, el);
                      else promptRefs.current.delete(template.id);
                    }}
                    rows={8}
                    defaultValue={template.promptTemplate}
                    onBlur={(e) => {
                      if (e.target.value !== template.promptTemplate) patchTemplate(template.id, { promptTemplate: e.target.value });
                    }}
                  />
                </div>
              </div>
            );
          })
      )}

      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
        <p className="mb-3 text-label-md text-neutral-900">Add a marketing template</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input placeholder="Name" value={newTemplate.name} onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))} />
          <Input
            placeholder="Category (optional)"
            value={newTemplate.category}
            onChange={(e) => setNewTemplate((t) => ({ ...t, category: e.target.value }))}
          />
          <Select
            value={newTemplate.outputType}
            onValueChange={(v) => {
              const nextOutputType = v as OutputType;
              setNewTemplate((t) => ({
                ...t,
                outputType: nextOutputType,
                aspectRatio: ASPECT_RATIOS_BY_OUTPUT_TYPE[nextOutputType].includes(t.aspectRatio)
                  ? t.aspectRatio
                  : ASPECT_RATIOS_BY_OUTPUT_TYPE[nextOutputType][0],
              }));
            }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newTemplate.aspectRatio} onValueChange={(v) => setNewTemplate((t) => ({ ...t, aspectRatio: v as AspectRatio }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS_BY_OUTPUT_TYPE[newTemplate.outputType].map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="primary" size="sm" className="mt-3" disabled={creating} onClick={handleCreate}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add Template
        </Button>
        <p className="mt-2 text-body-sm text-neutral-500">
          The template appears above immediately, fully editable — no separate page. Fill in the Prompt Template and set a
          Primary Provider to make it browsable.
        </p>
      </div>
    </div>
  );
}
