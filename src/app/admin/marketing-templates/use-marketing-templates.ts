"use client";

import * as React from "react";
import { toast } from "sonner";

import type { AssetRole, MarketingTemplate, OutputType, ProviderOption } from "./types";

// All data-fetching and mutation logic for the Marketing Templates admin
// UI, separated from rendering (2026-08-03 rewrite — the previous single
// ~600-line component mixed both together, which is exactly what made it
// hard to maintain). Every call here hits an existing, unmodified backend
// endpoint — no new routes.
export function useMarketingTemplates() {
  const [templates, setTemplates] = React.useState<MarketingTemplate[] | null>(null);
  const [providersByType, setProvidersByType] = React.useState<Record<OutputType, ProviderOption[]>>({ IMAGE: [], VIDEO: [] });

  // Real bug fix carried over from the previous implementation (2026-08-04)
  // — a failed refresh must never fail silently. Every caller of load()
  // gets a visible toast on failure instead of the page quietly keeping
  // whatever templates state it already had.
  const load = React.useCallback(() => {
    return fetch("/api/admin/marketing-templates")
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

  const loadProviders = React.useCallback(() => {
    (["IMAGE", "VIDEO"] as OutputType[]).forEach((outputType) => {
      fetch(`/api/admin/marketing-templates/providers?outputType=${outputType}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setProvidersByType((prev) => ({ ...prev, [outputType]: json.data.providers }));
        })
        .catch(() => {
          toast.error(`Couldn't load ${outputType.toLowerCase()} providers.`);
        });
    });
  }, []);

  React.useEffect(() => {
    load();
    loadProviders();
  }, [load, loadProviders]);

  async function createTemplate(input: { name: string; category: string | null; outputType: OutputType; aspectRatio: string }) {
    const res = await fetch("/api/admin/marketing-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => null);
    if (!json || !json.success) {
      toast.error(json?.error?.message ?? "Couldn't create template.");
      return null;
    }
    await load();
    return json.data.template.id as string;
  }

  async function patchTemplate(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/marketing-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!json || !json.success) {
      toast.error(json?.error?.message ?? "Couldn't save template.");
      return false;
    }
    await load();
    return true;
  }

  async function deleteTemplate(template: MarketingTemplate) {
    const res = await fetch(`/api/admin/marketing-templates/${template.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!json || !json.success) {
      toast.error(json?.error?.message ?? "Couldn't delete template.");
      return false;
    }
    toast.success("Template deleted.");
    await load();
    return true;
  }

  function referenceAssetOrderList(template: MarketingTemplate): { assetId: string; role: AssetRole | null }[] {
    return template.referenceAssets.map((r) => ({ assetId: r.assetId, role: r.role }));
  }

  // Full-replace PUT, optimistic-concurrency-guarded via
  // template.updatedAt (unchanged existing endpoint/contract).
  async function replaceReferenceAssets(template: MarketingTemplate, assets: { assetId: string; role: AssetRole | null }[]) {
    const res = await fetch(`/api/admin/marketing-templates/${template.id}/assets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedUpdatedAt: template.updatedAt, assets }),
    });
    const json = await res.json().catch(() => null);
    if (!json || !json.success) {
      if (json?.error?.code === "ERR_CONFLICT") {
        toast.error("Someone else changed this template. Reloading the latest version.");
      } else {
        toast.error(json?.error?.message ?? "Couldn't update reference assets.");
      }
      await load();
      return false;
    }
    await load();
    return true;
  }

  async function uploadAndAttachReferenceAsset(template: MarketingTemplate, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/marketing-templates/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => null);
    if (!json || !json.success) {
      toast.error(json?.error?.message ?? "Couldn't upload reference asset.");
      return false;
    }
    return replaceReferenceAssets(template, [...referenceAssetOrderList(template), { assetId: json.data.asset.id, role: null }]);
  }

  function removeReferenceAsset(template: MarketingTemplate, assetId: string) {
    return replaceReferenceAssets(
      template,
      referenceAssetOrderList(template).filter((a) => a.assetId !== assetId)
    );
  }

  function setReferenceAssetRole(template: MarketingTemplate, assetId: string, role: AssetRole | null) {
    return replaceReferenceAssets(
      template,
      referenceAssetOrderList(template).map((a) => (a.assetId === assetId ? { ...a, role } : a))
    );
  }

  function moveReferenceAsset(template: MarketingTemplate, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= template.referenceAssets.length) return Promise.resolve(false);
    const list = referenceAssetOrderList(template);
    [list[index], list[target]] = [list[target], list[index]];
    return replaceReferenceAssets(template, list);
  }

  return {
    templates,
    providersByType,
    createTemplate,
    patchTemplate,
    deleteTemplate,
    uploadAndAttachReferenceAsset,
    removeReferenceAsset,
    setReferenceAssetRole,
    moveReferenceAsset,
  };
}
