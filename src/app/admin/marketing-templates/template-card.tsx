"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Save, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";
import { cn } from "@/lib/utils";
import {
  ASSET_ROLE_LABELS,
  ASSET_ROLE_OPTIONS,
  NO_FALLBACK,
  NO_ROLE,
  OUTPUT_TYPE_OPTIONS,
  isTemplateReady,
  type AspectRatio,
  type AssetRole,
  type MarketingTemplate,
  type OutputType,
  type ProviderOption,
} from "./types";

interface GeneralFormState {
  name: string;
  description: string;
  category: string;
  outputType: OutputType;
  aspectRatio: AspectRatio;
  primaryProviderId: string | null;
  fallbackProviderId: string | null;
  userAssetRequired: boolean;
}

function toFormState(t: MarketingTemplate): GeneralFormState {
  return {
    name: t.name,
    description: t.description ?? "",
    category: t.category ?? "",
    outputType: t.outputType,
    aspectRatio: t.aspectRatio,
    primaryProviderId: t.primaryProviderId,
    fallbackProviderId: t.fallbackProviderId,
    userAssetRequired: t.userAssetRequired,
  };
}

export interface TemplateCardProps {
  template: MarketingTemplate;
  providerOptions: ProviderOption[];
  highlighted: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  promptRef: (el: HTMLTextAreaElement | null) => void;
  onPatch: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  onDelete: (template: MarketingTemplate) => Promise<boolean>;
  onUploadReferenceAsset: (template: MarketingTemplate, file: File) => Promise<boolean>;
  onRemoveReferenceAsset: (template: MarketingTemplate, assetId: string) => Promise<boolean>;
  onSetReferenceAssetRole: (template: MarketingTemplate, assetId: string, role: AssetRole | null) => Promise<boolean>;
  onMoveReferenceAsset: (template: MarketingTemplate, index: number, direction: -1 | 1) => Promise<boolean>;
}

// Step 2 — every template is this one, always-fully-visible card. No
// accordion, no second page, no modal. General/Providers/Generation are
// held as local state and committed together via the Save button in the
// footer; the Prompt Template textarea auto-saves independently on blur
// (called out explicitly in the brief); Reference Assets act immediately
// (each already has its own real, concurrency-guarded endpoint).
export function TemplateCard({
  template,
  providerOptions,
  highlighted,
  cardRef,
  promptRef,
  onPatch,
  onDelete,
  onUploadReferenceAsset,
  onRemoveReferenceAsset,
  onSetReferenceAssetRole,
  onMoveReferenceAsset,
}: TemplateCardProps) {
  const [form, setForm] = React.useState<GeneralFormState>(() => toFormState(template));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  // Re-sync local form state whenever the SERVER's version of this
  // template actually changes (a successful save, or someone else's edit)
  // — but never mid-typing from an unrelated re-render, since updatedAt
  // only moves on a real persisted change.
  React.useEffect(() => {
    setForm(toFormState(template));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.updatedAt]);

  const isReady = isTemplateReady(template);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("A name is required.");
      return;
    }
    setSaving(true);
    try {
      const ok = await onPatch(template.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        outputType: form.outputType,
        aspectRatio: form.aspectRatio,
        primaryProviderId: form.primaryProviderId,
        fallbackProviderId: form.fallbackProviderId,
        userAssetRequired: form.userAssetRequired,
      });
      if (ok) toast.success("Saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(template);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      await onUploadReferenceAsset(template, file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-4 transition-colors duration-300",
        highlighted && "border-amber-400 ring-2 ring-amber-200"
      )}
    >
      {/* Status header */}
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
        <Button
          type="button"
          variant={template.isActive ? "primary" : "secondary"}
          size="sm"
          onClick={() => onPatch(template.id, { isActive: !template.isActive })}
        >
          {template.isActive ? "Active" : "Inactive"}
        </Button>
      </div>

      {/* General */}
      <div className="mt-4">
        <p className="text-label-sm font-semibold text-neutral-500">General</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-label-sm text-neutral-600">Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-label-sm text-neutral-600">Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-label-sm text-neutral-600">Category</Label>
            <Input
              placeholder="e.g. Product Launch"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-label-sm text-neutral-600">Output Type</Label>
            <Select
              value={form.outputType}
              onValueChange={(v) => {
                const outputType = v as OutputType;
                setForm((f) => ({
                  ...f,
                  outputType,
                  aspectRatio: ASPECT_RATIOS_BY_OUTPUT_TYPE[outputType].includes(f.aspectRatio)
                    ? f.aspectRatio
                    : ASPECT_RATIOS_BY_OUTPUT_TYPE[outputType][0],
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
          </div>
          <div>
            <Label className="text-label-sm text-neutral-600">Aspect Ratio</Label>
            <Select value={form.aspectRatio} onValueChange={(v) => setForm((f) => ({ ...f, aspectRatio: v as AspectRatio }))}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS_BY_OUTPUT_TYPE[form.outputType].map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="mt-4">
        <p className="text-label-sm font-semibold text-neutral-500">Prompt</p>
        <Label className="mt-2 block text-label-sm text-neutral-600">
          Prompt Template — a complete, production-quality prompt. Users never see or edit this. Saves automatically.
        </Label>
        <Textarea
          ref={promptRef}
          rows={8}
          defaultValue={template.promptTemplate}
          onBlur={(e) => {
            if (e.target.value !== template.promptTemplate) onPatch(template.id, { promptTemplate: e.target.value });
          }}
        />
      </div>

      {/* Providers */}
      <div className="mt-4">
        <p className="text-label-sm font-semibold text-neutral-500">Providers</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-label-sm text-neutral-600">Primary Provider</Label>
            <Select
              value={form.primaryProviderId ?? undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, primaryProviderId: v }))}
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
              value={form.fallbackProviderId ?? NO_FALLBACK}
              onValueChange={(v) => setForm((f) => ({ ...f, fallbackProviderId: v === NO_FALLBACK ? null : v }))}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FALLBACK}>None</SelectItem>
                {providerOptions
                  .filter((p) => p.id !== form.primaryProviderId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Generation */}
      <div className="mt-4">
        <p className="text-label-sm font-semibold text-neutral-500">Generation</p>
        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            checked={form.userAssetRequired}
            onCheckedChange={(v) => setForm((f) => ({ ...f, userAssetRequired: Boolean(v) }))}
          />
          <Label className="text-label-sm text-neutral-600">User Asset Required</Label>
        </div>
      </div>

      {/* Reference Assets */}
      <div className="mt-4">
        <p className="text-label-sm font-semibold text-neutral-500">Reference Assets</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {template.referenceAssets.map((ref, index) => (
            <div key={ref.assetId} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
              <div className="size-10 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                {ref.asset.mimeType?.startsWith("video/") ? (
                  <video src={ref.asset.url} className="size-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ref.asset.url} alt="" className="size-full object-cover" />
                )}
              </div>
              <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-500">{ref.asset.mimeType ?? ref.assetId}</span>
              <Select
                value={ref.role ?? NO_ROLE}
                onValueChange={(v) => onSetReferenceAssetRole(template, ref.assetId, v === NO_ROLE ? null : (v as AssetRole))}
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
                onClick={() => onMoveReferenceAsset(template, index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={index === template.referenceAssets.length - 1}
                onClick={() => onMoveReferenceAsset(template, index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => onRemoveReferenceAsset(template, ref.assetId)}>
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
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
            Upload
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={handleSave}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={deleting}
          title={template._count.generations > 0 ? "Disable instead — real generations exist" : "Delete"}
          onClick={handleDelete}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete
        </Button>
      </div>
    </div>
  );
}
