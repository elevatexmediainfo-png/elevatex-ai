"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud, Trash2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { INDUSTRY_POSTER_META } from "@/lib/creative/poster-prompt";
import type { BusinessVertical } from "@/generated/prisma/enums";

const INDUSTRIES = Object.keys(INDUSTRY_POSTER_META) as BusinessVertical[];

interface ReferenceView {
  id: string;
  industry: BusinessVertical;
  url: string;
  mimeType: string | null;
  label: string | null;
  analysisStatus: "PENDING" | "READY" | "FAILED";
  isActive: boolean;
  createdAt: string;
}

interface GuidanceNoteView {
  industry: BusinessVertical;
  label: string;
  notes: string;
}

function StatusBadge({ status }: { status: ReferenceView["analysisStatus"] }) {
  if (status === "READY") return <Badge variant="success" size="sm">Analyzed</Badge>;
  if (status === "FAILED") return <Badge variant="error" size="sm">Analysis failed</Badge>;
  return <Badge variant="info" size="sm" pulse>Analyzing…</Badge>;
}

export function ReferenceLibraryManager() {
  const [activeIndustry, setActiveIndustry] = React.useState<BusinessVertical>(INDUSTRIES[0]!);
  const [references, setReferences] = React.useState<ReferenceView[] | null>(null);
  const [guidanceNotes, setGuidanceNotes] = React.useState<Map<BusinessVertical, string>>(new Map());
  const [noteDraft, setNoteDraft] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadReferences = React.useCallback((industry: BusinessVertical) => {
    setReferences(null);
    fetch(`/api/admin/reference-library?industry=${industry}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setReferences(json.data.references);
      });
  }, []);

  const loadGuidanceNotes = React.useCallback(() => {
    fetch("/api/admin/reference-library/guidance-notes")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setGuidanceNotes(new Map((json.data.notes as GuidanceNoteView[]).map((n) => [n.industry, n.notes])));
        }
      });
  }, []);

  React.useEffect(() => {
    loadReferences(activeIndustry);
  }, [activeIndustry, loadReferences]);

  React.useEffect(() => {
    loadGuidanceNotes();
  }, [loadGuidanceNotes]);

  React.useEffect(() => {
    setNoteDraft(guidanceNotes.get(activeIndustry) ?? "");
  }, [activeIndustry, guidanceNotes]);

  // Takes industry/notes as explicit arguments rather than reading
  // activeIndustry/noteDraft from closure at call time — Radix's
  // TabsTrigger switches tabs on mousedown (before blur fires on the
  // textarea), so an onBlur-only save would already see the NEW tab's
  // (reset) values by the time it runs, silently discarding the edit. This
  // version is called explicitly with the outgoing tab's values from
  // handleTabChange before the switch happens, so it no longer depends on
  // event-ordering at all.
  async function saveNoteFor(industry: BusinessVertical, notes: string) {
    if (notes === (guidanceNotes.get(industry) ?? "")) return;
    const res = await fetch("/api/admin/reference-library/guidance-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry, notes }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save the guidance note.");
      return;
    }
    setGuidanceNotes((prev) => new Map(prev).set(industry, notes));
  }

  function handleTabChange(next: BusinessVertical) {
    // Save the OUTGOING tab's draft first, using its own captured value —
    // see saveNoteFor's comment for why this can't be left to onBlur alone.
    saveNoteFor(activeIndustry, noteDraft);
    setActiveIndustry(next);
  }

  async function handleFiles(files: FileList) {
    setUploading(true);
    let failures = 0;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("industry", activeIndustry);
      try {
        const res = await fetch("/api/admin/reference-library/upload", { method: "POST", body: form });
        const json = await res.json();
        if (!json.success) {
          failures += 1;
          toast.error(`${file.name}: ${json.error?.message ?? "Upload failed."}`);
          continue;
        }
        setReferences((prev) => [json.data.reference, ...(prev ?? [])]);
      } catch {
        failures += 1;
        toast.error(`${file.name}: network error during upload.`);
      }
    }
    setUploading(false);
    if (failures === 0) toast.success(`Uploaded ${files.length} sample${files.length === 1 ? "" : "s"}.`);
  }

  async function toggleActive(reference: ReferenceView) {
    setReferences((prev) => prev?.map((r) => (r.id === reference.id ? { ...r, isActive: !r.isActive } : r)) ?? null);
    const res = await fetch(`/api/admin/reference-library/${reference.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !reference.isActive }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't update this sample.");
      loadReferences(activeIndustry);
    }
  }

  async function retryAnalysis(reference: ReferenceView) {
    setReferences((prev) => prev?.map((r) => (r.id === reference.id ? { ...r, analysisStatus: "PENDING" } : r)) ?? null);
    const res = await fetch(`/api/admin/reference-library/${reference.id}/reanalyze`, { method: "POST" });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Retry failed.");
    }
    loadReferences(activeIndustry);
  }

  async function deleteReference(reference: ReferenceView) {
    setReferences((prev) => prev?.filter((r) => r.id !== reference.id) ?? null);
    const res = await fetch(`/api/admin/reference-library/${reference.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't delete this sample.");
      loadReferences(activeIndustry);
    }
  }

  return (
    <Tabs value={activeIndustry} onValueChange={(v) => handleTabChange(v as BusinessVertical)}>
      <TabsList variant="line" className="flex-wrap">
        {INDUSTRIES.map((industry) => (
          <TabsTrigger key={industry} value={industry}>
            {INDUSTRY_POSTER_META[industry].label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={activeIndustry} className="mt-6 flex flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-label-lg text-neutral-900">Guidance notes</h2>
          <p className="text-body-sm text-neutral-500">
            What good copy, layout, and text placement look like for {INDUSTRY_POSTER_META[activeIndustry].label}.
          </p>
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => saveNoteFor(activeIndustry, noteDraft)}
            rows={4}
            placeholder="e.g. Lead with the free-consultation CTA, keep the headline under 6 words, always show the WhatsApp number..."
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-label-lg text-neutral-900">Samples</h2>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              Upload samples
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {references === null ? (
            <p className="text-body-sm text-neutral-400">Loading…</p>
          ) : references.length === 0 ? (
            <p className="text-body-sm text-neutral-400">
              No samples yet for {INDUSTRY_POSTER_META[activeIndustry].label}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {references.map((reference) => (
                <div key={reference.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-2">
                  <div className="aspect-square overflow-hidden rounded-md bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={reference.url} alt={reference.label ?? "Reference sample"} className="size-full object-cover" />
                  </div>
                  <StatusBadge status={reference.analysisStatus} />
                  {reference.label && <p className="truncate text-label-sm text-neutral-700">{reference.label}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={reference.isActive} onCheckedChange={() => toggleActive(reference)} />
                      <span className="text-label-sm text-neutral-500">{reference.isActive ? "Active" : "Inactive"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {reference.analysisStatus === "FAILED" && (
                        <button
                          type="button"
                          onClick={() => retryAnalysis(reference)}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          aria-label="Retry analysis"
                        >
                          <RefreshCw className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteReference(reference)}
                        className="rounded p-1 text-neutral-400 hover:bg-error-light hover:text-error"
                        aria-label="Delete sample"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
