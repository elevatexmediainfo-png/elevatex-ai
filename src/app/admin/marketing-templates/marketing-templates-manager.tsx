"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MarketingTemplate {
  id: string;
  name: string;
  outputType: "IMAGE" | "VIDEO";
  promptTemplate: string;
  primaryProviderId: string | null;
  isActive: boolean;
  _count: { generations: number };
}

// Same list-page shape as TemplatesManager (src/app/admin/templates/
// templates-manager.tsx) — a plain table, per-row quick actions
// (Active/Disabled toggle, Delete), reused wherever possible per the
// founder's own requirement. "Add Template" (2026-08-04) — Video
// Templates has no dedicated editor page to actually reuse (confirmed: no
// [id] admin routes exist anywhere in this codebase before this one), so
// this is a genuinely new pattern for THIS entity, built per the
// founder's explicit approval — creating a bare row and navigating
// straight into its own editor page, rather than the old inline-card
// two-step ("create a shell, then hunt for it below to fill in the rest").
export function MarketingTemplatesManager() {
  const router = useRouter();
  const [templates, setTemplates] = React.useState<MarketingTemplate[] | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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

  // Requirement 1 — no fields collected here at all: create a bare row
  // (name defaults to "Untitled template", everything else stays whatever
  // the API's own defaults are) and navigate straight into its editor.
  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/marketing-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled template", outputType: "IMAGE", aspectRatio: "RATIO_1_1" }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create template.");
        return;
      }
      router.push(`/admin/marketing-templates/${json.data.template.id}`);
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
              <th className="px-4 py-2">Output type</th>
              <th className="px-4 py-2">Ready</th>
              <th className="px-4 py-2">Generations</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No marketing templates yet.
                </td>
              </tr>
            ) : (
              templates.map((t) => {
                const isReady = Boolean(t.primaryProviderId) && t.promptTemplate.trim().length > 0;
                return (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-neutral-900">
                      <Link href={`/admin/marketing-templates/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{t.outputType}</td>
                    <td className="px-4 py-2">
                      <Badge variant={isReady ? "success" : "warning"} outline>
                        {isReady ? "Ready" : "Incomplete"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{t._count.generations}</td>
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
                    <td className="px-4 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingId === t.id}
                        title={t._count.generations > 0 ? "Disable instead — real generations exist" : "Delete"}
                        onClick={() => deleteTemplate(t)}
                      >
                        {deletingId === t.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="primary" size="sm" className="w-fit" disabled={creating} onClick={handleCreate}>
        {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add Template
      </Button>
    </div>
  );
}
