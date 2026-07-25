"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASPECT_RATIOS_BY_OUTPUT_TYPE } from "@/lib/marketing-templates/aspect-ratios";

type OutputType = "IMAGE" | "VIDEO";
type AspectRatio = "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";

interface MarketingTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  outputType: OutputType;
  aspectRatio: AspectRatio;
  referenceMediaAssetId: string | null;
  referenceMediaAsset: { id: string; storageKey: string; mimeType: string | null } | null;
  promptTemplate: string;
  preferredProviderId: string | null;
  creditCost: number;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  _count: { generations: number };
}

const OUTPUT_TYPE_OPTIONS: OutputType[] = ["IMAGE", "VIDEO"];

const emptyNewTemplate = {
  name: "",
  category: "",
  outputType: "IMAGE" as OutputType,
  aspectRatio: "RATIO_1_1" as AspectRatio,
};

// Extracted here too (not imported from lib/marketing-templates/placeholders.ts,
// a server-only-adjacent module path this client component shouldn't pull
// in) — same regex, purely for the admin's own live preview of which
// {{fields}} a prompt will generate; the real, authoritative extraction
// that actually gates generation runs server-side.
function extractPlaceholdersPreview(promptTemplate: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of promptTemplate.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      ordered.push(match[1]);
    }
  }
  return ordered;
}

export function MarketingTemplatesManager() {
  const [templates, setTemplates] = React.useState<MarketingTemplate[] | null>(null);
  const [newTemplate, setNewTemplate] = React.useState(emptyNewTemplate);
  const [creating, setCreating] = React.useState(false);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    fetch("/api/admin/marketing-templates")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setTemplates(json.data.templates);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

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
    const res = await fetch(`/api/admin/marketing-templates/${template.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't delete template.");
      return;
    }
    toast.success("Template deleted.");
    load();
  }

  async function uploadReferenceMedia(template: MarketingTemplate, file: File) {
    setUploadingId(template.id);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/marketing-templates/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't upload reference media.");
        return;
      }
      await patchTemplate(template.id, { referenceMediaAssetId: json.data.asset.id });
    } finally {
      setUploadingId(null);
    }
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
      toast.success("Template created — add reference media and a prompt to make it browsable.");
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
            const placeholders = extractPlaceholdersPreview(template.promptTemplate);
            const isReady = Boolean(template.referenceMediaAssetId) && template.promptTemplate.trim().length > 0;
            return (
              <div key={template.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-label-md text-neutral-900">{template.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={isReady ? "success" : "warning"} outline>
                        {isReady ? "Ready" : "Not browsable yet — needs reference media + prompt"}
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
                      title={template._count.generations > 0 ? "Disable instead — real generations exist" : "Delete"}
                      onClick={() => deleteTemplate(template)}
                    >
                      <Trash2 className="size-4" />
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
                    <Label className="text-label-sm text-neutral-600">Preferred provider id</Label>
                    <Input
                      defaultValue={template.preferredProviderId ?? ""}
                      placeholder="(category default)"
                      onBlur={(e) => {
                        if (e.target.value !== (template.preferredProviderId ?? "")) {
                          patchTemplate(template.id, { preferredProviderId: e.target.value || null });
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-label-sm text-neutral-600">Reference media</Label>
                    <div className="flex items-center gap-2">
                      {template.referenceMediaAsset ? (
                        <span className="text-body-sm text-neutral-500">Set — {template.referenceMediaAsset.mimeType}</span>
                      ) : (
                        <span className="text-body-sm text-neutral-400">Not set</span>
                      )}
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-label-sm text-neutral-600">
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadReferenceMedia(template, file);
                            e.target.value = "";
                          }}
                        />
                        {uploadingId === template.id ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
                        {template.referenceMediaAsset ? "Replace" : "Upload"}
                      </label>
                    </div>
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
                    Prompt template — use {"{{placeholderName}}"} for fields the user fills in
                  </Label>
                  <Textarea
                    rows={3}
                    defaultValue={template.promptTemplate}
                    onBlur={(e) => {
                      if (e.target.value !== template.promptTemplate) patchTemplate(template.id, { promptTemplate: e.target.value });
                    }}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-label-sm text-neutral-400">Detected fields:</span>
                    {placeholders.length === 0 ? (
                      <span className="text-label-sm text-neutral-400">none</span>
                    ) : (
                      placeholders.map((p) => (
                        <Badge key={p} variant="brand" outline>
                          {p}
                        </Badge>
                      ))
                    )}
                  </div>
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
          Add template
        </Button>
        <p className="mt-2 text-body-sm text-neutral-500">
          A new template starts <Badge variant="warning" outline>not browsable</Badge> until you upload reference media and write a
          prompt below — matches the &quot;no fake UI&quot; rule for the user-facing gallery.
        </p>
      </div>
    </div>
  );
}
