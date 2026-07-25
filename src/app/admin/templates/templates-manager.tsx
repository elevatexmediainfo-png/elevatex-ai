"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BUSINESS_VERTICALS = [
  "RESTAURANT",
  "CAFE_BAKERY",
  "SALON_SPA",
  "DENTAL_DIAGNOSTIC",
  "REAL_ESTATE",
  "RETAIL",
  "GYM_FITNESS",
  "HOSPITAL",
  "COACHING_EDTECH",
  "HOTEL",
  "FINANCE",
  "OTHER",
] as const;
const VIDEO_PLATFORMS = ["INSTAGRAM_REEL", "INSTAGRAM_POST", "FACEBOOK", "YOUTUBE_SHORTS", "WHATSAPP_STATUS", "GOOGLE_BUSINESS"] as const;
const ASPECT_RATIOS = ["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"] as const;
const VIDEO_OBJECTIVES = ["", "PROMOTION", "NEW_LAUNCH", "FESTIVAL_GREETING", "TESTIMONIAL", "ANNOUNCEMENT", "OFFER_DISCOUNT", "BRAND_AWARENESS"] as const;

interface Template {
  id: string;
  name: string;
  description: string | null;
  vertical: string;
  platform: string;
  aspectRatio: string;
  durationSeconds: number;
  creditCost: number;
  isActive: boolean;
  isFeatured: boolean;
  defaultObjective: string | null;
  promptTemplate: string;
}

const emptyNewTemplate = {
  name: "",
  vertical: "RESTAURANT" as (typeof BUSINESS_VERTICALS)[number],
  platform: "INSTAGRAM_REEL" as (typeof VIDEO_PLATFORMS)[number],
  aspectRatio: "RATIO_9_16" as (typeof ASPECT_RATIOS)[number],
  promptTemplate: "",
};

export function TemplatesManager() {
  const [templates, setTemplates] = React.useState<Template[] | null>(null);
  const [newTemplate, setNewTemplate] = React.useState(emptyNewTemplate);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    fetch("/api/admin/templates")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setTemplates(json.data.templates);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function patchTemplate(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/templates/${id}`, {
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

  async function handleCreate() {
    if (!newTemplate.name.trim() || !newTemplate.promptTemplate.trim()) {
      toast.error("Fill in a name and a prompt template.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplate.name.trim(),
          vertical: newTemplate.vertical,
          platform: newTemplate.platform,
          aspectRatio: newTemplate.aspectRatio,
          promptTemplate: newTemplate.promptTemplate.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create template.");
        return;
      }
      toast.success("Template created.");
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
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-body-sm">
          <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Vertical</th>
              <th className="px-4 py-2">Featured</th>
              <th className="px-4 py-2">Default objective</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No templates yet.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-neutral-900">{t.name}</td>
                  <td className="px-4 py-2 text-neutral-500">{t.vertical}</td>
                  <td className="px-4 py-2">
                    <Button
                      type="button"
                      variant={t.isFeatured ? "primary" : "outline"}
                      size="sm"
                      onClick={() => patchTemplate(t.id, { isFeatured: !t.isFeatured })}
                    >
                      {t.isFeatured ? "Featured" : "Feature it"}
                    </Button>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      value={t.defaultObjective ?? ""}
                      onValueChange={(v) => patchTemplate(t.id, { defaultObjective: v || null })}
                    >
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        {VIDEO_OBJECTIVES.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o || "None"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      type="button"
                      variant={t.isActive ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => patchTemplate(t.id, { isActive: !t.isActive })}
                    >
                      <Badge variant={t.isActive ? "success" : "neutral"} outline>
                        {t.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
        <p className="mb-3 text-label-md text-neutral-900">Add a template</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input placeholder="Name" value={newTemplate.name} onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))} />
          <Select value={newTemplate.vertical} onValueChange={(v) => setNewTemplate((t) => ({ ...t, vertical: v as typeof t.vertical }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_VERTICALS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newTemplate.platform} onValueChange={(v) => setNewTemplate((t) => ({ ...t, platform: v as typeof t.platform }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIDEO_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newTemplate.aspectRatio} onValueChange={(v) => setNewTemplate((t) => ({ ...t, aspectRatio: v as typeof t.aspectRatio }))}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Label className="mt-3 text-label-sm text-neutral-600">Prompt template</Label>
        <Textarea
          rows={3}
          value={newTemplate.promptTemplate}
          onChange={(e) => setNewTemplate((t) => ({ ...t, promptTemplate: e.target.value }))}
        />
        <Button type="button" variant="primary" size="sm" className="mt-3" disabled={creating} onClick={handleCreate}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add template
        </Button>
      </div>
    </div>
  );
}
