"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Save, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";

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
  updatedAt: string;
  _count: { generations: number };
}

// Editable core fields, held as local controlled state and committed
// together via the single Save button (2026-08-04) — everything else
// (reference assets, delete, the isActive toggle) keeps its own existing,
// already-separately-endpointed immediate action, unchanged from before
// this page existed, just moved here from the old inline card.
interface FormState {
  name: string;
  category: string;
  promptTemplate: string;
  outputType: OutputType;
  aspectRatio: AspectRatio;
  primaryProviderId: string | null;
  fallbackProviderId: string | null;
  userAssetRequired: boolean;
}

function toFormState(t: MarketingTemplate): FormState {
  return {
    name: t.name,
    category: t.category ?? "",
    promptTemplate: t.promptTemplate,
    outputType: t.outputType,
    aspectRatio: t.aspectRatio,
    primaryProviderId: t.primaryProviderId,
    fallbackProviderId: t.fallbackProviderId,
    userAssetRequired: t.userAssetRequired,
  };
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [template, setTemplate] = React.useState<MarketingTemplate | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [providersByType, setProvidersByType] = React.useState<Record<OutputType, ProviderOption[]>>({ IMAGE: [], VIDEO: [] });

  const load = React.useCallback(() => {
    fetch(`/api/admin/marketing-templates/${templateId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setNotFound(true);
          return;
        }
        setTemplate(json.data.template);
        setForm((prev) => prev ?? toFormState(json.data.template));
      });
  }, [templateId]);

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

  async function handleSave() {
    if (!template || !form) return;
    if (!form.name.trim()) {
      toast.error("A name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketing-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim() || null,
          promptTemplate: form.promptTemplate,
          outputType: form.outputType,
          aspectRatio: form.aspectRatio,
          primaryProviderId: form.primaryProviderId,
          fallbackProviderId: form.fallbackProviderId,
          userAssetRequired: form.userAssetRequired,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save template.");
        return;
      }
      setTemplate(json.data.template);
      setForm(toFormState(json.data.template));
      toast.success("Template saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!template) return;
    const res = await fetch(`/api/admin/marketing-templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !template.isActive }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't update status.");
      return;
    }
    setTemplate(json.data.template);
  }

  async function handleDelete() {
    if (!template) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/marketing-templates/${templateId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't delete template.");
        return;
      }
      toast.success("Template deleted.");
      router.push("/admin/marketing-templates");
    } finally {
      setDeleting(false);
    }
  }

  // Reference-asset management — unchanged from the old inline card (moved
  // here, not duplicated): full-replace PUT, optimistic-concurrency-guarded
  // via template.updatedAt (Production Hardening, 2026-08-03).
  function asOrderList(t: MarketingTemplate): { assetId: string; role: AssetRole | null }[] {
    return t.referenceAssets.map((r) => ({ assetId: r.assetId, role: r.role }));
  }

  async function replaceReferenceAssets(assets: { assetId: string; role: AssetRole | null }[]) {
    if (!template) return;
    const res = await fetch(`/api/admin/marketing-templates/${templateId}/assets`, {
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

  async function uploadAndAttachReferenceAsset(file: File) {
    if (!template) return;
    setUploading(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      const res = await fetch("/api/admin/marketing-templates/upload", { method: "POST", body: uploadForm });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't upload reference asset.");
        return;
      }
      await replaceReferenceAssets([...asOrderList(template), { assetId: json.data.asset.id, role: null }]);
    } finally {
      setUploading(false);
    }
  }

  function removeReferenceAsset(assetId: string) {
    if (!template) return;
    void replaceReferenceAssets(asOrderList(template).filter((a) => a.assetId !== assetId));
  }

  function setReferenceAssetRole(assetId: string, role: AssetRole | null) {
    if (!template) return;
    void replaceReferenceAssets(asOrderList(template).map((a) => (a.assetId === assetId ? { ...a, role } : a)));
  }

  function moveReferenceAsset(index: number, direction: -1 | 1) {
    if (!template) return;
    const target = index + direction;
    if (target < 0 || target >= template.referenceAssets.length) return;
    const list = asOrderList(template);
    [list[index], list[target]] = [list[target], list[index]];
    void replaceReferenceAssets(list);
  }

  if (notFound) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-neutral-500">This marketing template doesn&apos;t exist.</p>
        <Link href="/admin/marketing-templates" className="text-label-sm text-neutral-600 hover:underline">
          <ArrowLeft className="mr-1 inline size-3.5" /> Back to Marketing Templates
        </Link>
      </div>
    );
  }

  if (!template || !form) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  const isReady = Boolean(form.primaryProviderId) && form.promptTemplate.trim().length > 0;
  const providerOptions = providersByType[form.outputType];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/admin/marketing-templates" className="flex items-center gap-1 text-label-sm text-neutral-500 hover:underline">
          <ArrowLeft className="size-3.5" /> Marketing Templates
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={isReady ? "success" : "warning"} outline>
            {isReady ? "Ready" : "Not browsable yet — needs a Master Prompt + Primary Provider"}
          </Badge>
          <Button type="button" variant={template.isActive ? "primary" : "secondary"} size="sm" onClick={toggleActive}>
            {template.isActive ? "Active" : "Inactive"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={deleting}
            title={template._count.generations > 0 ? "Disable instead — real generations exist" : "Delete"}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label className="text-label-sm text-neutral-600">Template Name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
        </div>
        <div>
          <Label className="text-label-sm text-neutral-600">Category</Label>
          <Input
            placeholder="e.g. Product Launch"
            value={form.category}
            onChange={(e) => setForm((f) => f && { ...f, category: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-label-sm text-neutral-600">Output Type</Label>
          <Select
            value={form.outputType}
            onValueChange={(v) => {
              const nextOutputType = v as OutputType;
              setForm((f) => {
                if (!f) return f;
                const stillValid = ASPECT_RATIOS_BY_OUTPUT_TYPE[nextOutputType].includes(f.aspectRatio);
                return { ...f, outputType: nextOutputType, aspectRatio: stillValid ? f.aspectRatio : ASPECT_RATIOS_BY_OUTPUT_TYPE[nextOutputType][0] };
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
          <Label className="text-label-sm text-neutral-600">Aspect Ratio</Label>
          <Select value={form.aspectRatio} onValueChange={(v) => setForm((f) => f && { ...f, aspectRatio: v as AspectRatio })}>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-label-sm text-neutral-600">Primary Provider</Label>
          <Select value={form.primaryProviderId ?? undefined} onValueChange={(v) => setForm((f) => f && { ...f, primaryProviderId: v })}>
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
            onValueChange={(v) => setForm((f) => f && { ...f, fallbackProviderId: v === NO_FALLBACK ? null : v })}
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
        <div className="flex items-end gap-2 pb-1.5">
          <Checkbox
            checked={form.userAssetRequired}
            onCheckedChange={(v) => setForm((f) => f && { ...f, userAssetRequired: Boolean(v) })}
          />
          <Label className="text-label-sm text-neutral-600">User Asset Required</Label>
        </div>
      </div>

      <div>
        <Label className="text-label-sm text-neutral-600">Ordered Reference Assets (optional)</Label>
        <div className="flex flex-col gap-1.5">
          {template.referenceAssets.map((ref, index) => (
            <div key={ref.assetId} className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-500">{ref.asset.mimeType ?? ref.assetId}</span>
              <Select
                value={ref.role ?? NO_ROLE}
                onValueChange={(v) => setReferenceAssetRole(ref.assetId, v === NO_ROLE ? null : (v as AssetRole))}
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
              <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => moveReferenceAsset(index, -1)}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={index === template.referenceAssets.length - 1}
                onClick={() => moveReferenceAsset(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeReferenceAsset(ref.assetId)}>
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
                if (file) void uploadAndAttachReferenceAsset(file);
                e.target.value = "";
              }}
            />
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
            Add reference asset
          </label>
        </div>
      </div>

      <div>
        <Label className="text-label-sm text-neutral-600">
          Prompt Template (Master Prompt) — a complete, production-quality prompt. Users never see or edit this.
        </Label>
        <Textarea
          rows={8}
          value={form.promptTemplate}
          onChange={(e) => setForm((f) => f && { ...f, promptTemplate: e.target.value })}
        />
      </div>

      <Button type="button" variant="primary" size="default" className="w-fit" disabled={saving} onClick={handleSave}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save
      </Button>
    </div>
  );
}
