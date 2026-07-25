"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { BenchmarkFull, BenchmarkSummary, BestPerformer, RatingData, VariantSummary } from "@/lib/benchmark/types";

// ─── Utility ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-label-sm text-neutral-600 transition-colors hover:bg-neutral-50"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

const RATING_DIMS: { key: keyof RatingData; label: string }[] = [
  { key: "commercialAppeal",       label: "Commercial Appeal" },
  { key: "storytelling",           label: "Storytelling" },
  { key: "composition",            label: "Composition" },
  { key: "realism",                label: "Realism" },
  { key: "premiumFeel",            label: "Premium Feel" },
  { key: "scrollStopping",         label: "Scroll Stopping" },
  { key: "brandFit",               label: "Brand Fit" },
  { key: "marketingEffectiveness", label: "Marketing Effectiveness" },
  { key: "overallScore",           label: "Overall Score" },
];

const ASPECT_OPTIONS: { label: string; value: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9" }[] = [
  { label: "9:16 (Story)", value: "RATIO_9_16" },
  { label: "1:1 (Square)", value: "RATIO_1_1" },
  { label: "16:9 (Banner)", value: "RATIO_16_9" },
];

const VARIANT_COLORS: Record<string, string> = {
  balanced:          "bg-blue-50 border-blue-200 text-blue-700",
  story_first:       "bg-purple-50 border-purple-200 text-purple-700",
  composition_first: "bg-amber-50 border-amber-200 text-amber-700",
  marketing_first:   "bg-green-50 border-green-200 text-green-700",
};

function statusBadge(status: VariantSummary["status"]) {
  switch (status) {
    case "pending":    return <Badge variant="neutral" outline>pending</Badge>;
    case "generating": return <Badge variant="info" outline>generating…</Badge>;
    case "generated":  return <Badge variant="success" outline>generated</Badge>;
    case "failed":     return <Badge variant="error" outline>failed</Badge>;
  }
}

// ─── Rating form ──────────────────────────────────────────────────────────────

function RatingForm({
  variantId,
  benchmarkId,
  initial,
  onSaved,
}: {
  variantId:   string;
  benchmarkId: string;
  initial:     RatingData | null;
  onSaved:     (r: RatingData) => void;
}) {
  const defaultValues = RATING_DIMS.reduce<Record<string, number>>((acc, d) => {
    acc[d.key] = initial ? (initial[d.key] as number) : 7;
    return acc;
  }, {});
  const [values, setValues] = React.useState<Record<string, number>>(defaultValues);
  const [notes,  setNotes]  = React.useState(initial?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error,  setError]  = React.useState<string | null>(null);

  const set = (key: string, v: number) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/prompt-lab/${benchmarkId}/rate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ variantId, rating: { ...values, notes: notes || undefined } }),
      });
      const json = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!json.success) throw new Error(json.error?.message ?? "Save failed.");
      onSaved({ ...(values as unknown as RatingData), notes: notes || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-label-sm text-neutral-700">Rate this image (1–10)</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {RATING_DIMS.map(d => (
          <div key={d.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">{d.label}</span>
              <span className="text-label-sm font-semibold text-neutral-900">{values[d.key]}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={values[d.key]}
              onChange={e => set(d.key, Number(e.target.value))}
              className="w-full accent-brand-navy"
            />
          </div>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional notes…"
        rows={2}
        className="w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-body-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="self-start rounded-lg bg-brand-navy px-4 py-2 text-label-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : initial ? "Update Rating" : "Save Rating"}
      </button>
    </div>
  );
}

// ─── Single variant card ──────────────────────────────────────────────────────

function VariantCard({
  variant,
  benchmarkId,
  isWinner,
  onGenerate,
  onRatingSaved,
  onMarkWinner,
}: {
  variant:       VariantSummary;
  benchmarkId:   string;
  isWinner:      boolean;
  onGenerate:    (v: VariantSummary) => void;
  onRatingSaved: (variantId: string, r: RatingData) => void;
  onMarkWinner:  (variantId: string) => void;
}) {
  const [showPrompt,   setShowPrompt]   = React.useState(false);
  const [showRating,   setShowRating]   = React.useState(false);
  const [markingWinner, setMarkingWinner] = React.useState(false);
  const [lightbox,      setLightbox]    = React.useState(false);

  const colorClass = VARIANT_COLORS[variant.variantType] ?? "bg-neutral-50 border-neutral-200 text-neutral-700";

  const markWinner = async () => {
    setMarkingWinner(true);
    try {
      const res = await fetch(`/api/admin/prompt-lab/${benchmarkId}/winner`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ variantId: variant.id }),
      });
      const json = (await res.json()) as { success: boolean };
      if (json.success) onMarkWinner(variant.id);
    } finally {
      setMarkingWinner(false);
    }
  };

  return (
    <>
      <div className={`relative flex flex-col rounded-xl border-2 bg-white p-5 ${isWinner ? "border-amber-400 ring-2 ring-amber-200" : "border-neutral-200"}`}>
        {isWinner && (
          <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-xs font-semibold text-amber-700">
            ★ Winner
          </div>
        )}

        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <span className={`rounded-full border px-3 py-0.5 text-label-sm font-semibold ${colorClass}`}>
            {variant.variantLabel}
          </span>
          {statusBadge(variant.status)}
        </div>

        {/* Focus description */}
        <p className="mb-3 text-xs text-neutral-500">{variant.focus}</p>

        {/* Stats */}
        <div className="mb-3 flex gap-4 text-xs text-neutral-400">
          <span>{variant.promptLength.toLocaleString()} chars</span>
          <span>~{variant.tokenCount.toLocaleString()} tokens</span>
          {variant.executionMs != null && <span>{variant.executionMs.toLocaleString()} ms</span>}
        </div>

        {/* Prompt toggle */}
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrompt(p => !p)}
              className="text-label-sm text-brand-navy underline hover:no-underline"
            >
              {showPrompt ? "Hide prompt" : "Show prompt"}
            </button>
            <CopyButton text={variant.finalPrompt} />
          </div>
          {showPrompt && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700 whitespace-pre-wrap">
              {variant.finalPrompt}
            </pre>
          )}
        </div>

        {/* Image */}
        {variant.imageUrl ? (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="group relative block w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={variant.imageUrl}
                alt={`Variant ${variant.variantLabel}`}
                className="w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                style={{ maxHeight: 280 }}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                <span className="hidden rounded-full bg-black/60 px-3 py-1 text-xs text-white group-hover:block">
                  Zoom
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="mb-3 flex items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50 py-12 text-xs text-neutral-400">
            No image yet
          </div>
        )}

        {/* Error message */}
        {variant.errorMessage && (
          <p className="mb-3 rounded-lg border border-error-light bg-error-light px-3 py-2 text-xs text-error">
            {variant.errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-wrap gap-2">
          {variant.status !== "generating" && (
            <button
              type="button"
              onClick={() => onGenerate(variant)}
              className="rounded-lg border border-brand-navy px-4 py-2 text-label-sm text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
            >
              {variant.status === "generated" ? "Re-generate" : "Generate Image"}
            </button>
          )}
          {variant.status === "generating" && (
            <span className="text-label-sm text-neutral-400">Generating…</span>
          )}
          {variant.imageUrl && (
            <button
              type="button"
              onClick={() => setShowRating(r => !r)}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-label-sm text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              {showRating ? "Hide Rating" : variant.rating ? "Edit Rating" : "Rate Image"}
            </button>
          )}
          {variant.imageUrl && !isWinner && (
            <button
              type="button"
              onClick={() => void markWinner()}
              disabled={markingWinner}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-label-sm text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              {markingWinner ? "Marking…" : "★ Mark Winner"}
            </button>
          )}
        </div>

        {/* Rating display */}
        {variant.rating && !showRating && (
          <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
            <div className="flex flex-wrap gap-2">
              {RATING_DIMS.map(d => (
                <span key={d.key} className="text-xs text-neutral-500">
                  {d.label.split(" ").map(w => w[0]).join("")}: <span className="font-semibold text-neutral-800">{variant.rating![d.key] as number}</span>
                </span>
              ))}
            </div>
            {variant.rating.notes && (
              <p className="mt-2 text-xs italic text-neutral-500">{variant.rating.notes}</p>
            )}
          </div>
        )}

        {showRating && (
          <RatingForm
            variantId={variant.id}
            benchmarkId={benchmarkId}
            initial={variant.rating}
            onSaved={r => {
              onRatingSaved(variant.id, r);
              setShowRating(false);
            }}
          />
        )}
      </div>

      {/* Lightbox */}
      {lightbox && variant.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={variant.imageUrl}
              alt={`Variant ${variant.variantLabel} fullscreen`}
              className="w-full rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute -top-4 -right-4 rounded-full bg-white p-2 text-neutral-600 shadow-lg hover:bg-neutral-100"
            >
              ✕
            </button>
            <p className="mt-2 text-center text-sm text-white">{variant.variantLabel}</p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── New Benchmark tab ────────────────────────────────────────────────────────

function NewBenchmarkTab() {
  const [idea,          setIdea]         = React.useState("");
  const [aspectRatio,   setAspectRatio]  = React.useState<"RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9">("RATIO_9_16");
  const [creating,      setCreating]     = React.useState(false);
  const [error,         setError]        = React.useState<string | null>(null);
  const [benchmark,     setBenchmark]    = React.useState<BenchmarkFull | null>(null);

  const create = async () => {
    if (!idea.trim()) return;
    setCreating(true);
    setError(null);
    setBenchmark(null);
    try {
      const res = await fetch("/api/admin/prompt-lab/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rawIdea: idea.trim(), aspectRatio }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { benchmarkId: string; variants: VariantSummary[] };
        error?: { message?: string };
      };
      if (!json.success || !json.data) throw new Error(json.error?.message ?? "Failed to create benchmark.");
      setBenchmark({
        id:           json.data.benchmarkId,
        rawIdea:      idea.trim(),
        industry:     "",
        gptMode:      "gpt",
        gptDirection: null,
        winnerId:     null,
        createdAt:    new Date().toISOString(),
        variants:     json.data.variants,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setCreating(false);
    }
  };

  const generateImage = async (variant: VariantSummary) => {
    if (!benchmark) return;
    // Optimistic: set status to generating
    setBenchmark(prev =>
      prev
        ? { ...prev, variants: prev.variants.map(v => v.id === variant.id ? { ...v, status: "generating" } : v) }
        : prev
    );
    try {
      const res = await fetch(`/api/admin/prompt-lab/${benchmark.id}/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ variantId: variant.id, aspectRatio }),
      });
      const json = (await res.json()) as { success: boolean; data?: VariantSummary; error?: { message?: string } };
      if (!json.success || !json.data) throw new Error(json.error?.message ?? "Generation failed.");
      setBenchmark(prev =>
        prev
          ? { ...prev, variants: prev.variants.map(v => v.id === variant.id ? json.data! : v) }
          : prev
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed.";
      setBenchmark(prev =>
        prev
          ? { ...prev, variants: prev.variants.map(v => v.id === variant.id ? { ...v, status: "failed", errorMessage: msg } : v) }
          : prev
      );
    }
  };

  const onRatingSaved = (variantId: string, r: RatingData) => {
    setBenchmark(prev =>
      prev
        ? { ...prev, variants: prev.variants.map(v => v.id === variantId ? { ...v, rating: r } : v) }
        : prev
    );
  };

  const onMarkWinner = (variantId: string) => {
    setBenchmark(prev => prev ? { ...prev, winnerId: variantId } : prev);
  };

  const generateAll = async () => {
    if (!benchmark) return;
    for (const v of benchmark.variants) {
      if (v.status !== "generating") {
        await generateImage(v);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Input */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="mb-3 text-label-lg text-neutral-900">Campaign Idea</p>
        <textarea
          value={idea}
          onChange={e => setIdea(e.target.value)}
          placeholder="e.g. Dental implants — make pain-free smiles feel achievable for nervous patients"
          rows={3}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-body-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {ASPECT_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setAspectRatio(o.value)}
                className={`rounded-lg border px-3 py-1.5 text-label-sm transition-colors ${
                  aspectRatio === o.value
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !idea.trim()}
            className="rounded-lg bg-brand-navy px-5 py-2 text-label-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Building variants…" : "Run Benchmark"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-error-light bg-error-light px-4 py-2 text-body-sm text-error">
            {error}
          </p>
        )}
      </div>

      {/* Loading skeleton */}
      {creating && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["A", "B", "C", "D"].map(l => (
            <div key={l} className="h-96 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      )}

      {/* 4 variant cards */}
      {benchmark && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-label-lg text-neutral-900">
              4 Variants — <span className="font-normal text-neutral-500 text-body-sm">{benchmark.rawIdea.slice(0, 60)}{benchmark.rawIdea.length > 60 ? "…" : ""}</span>
            </p>
            <button
              type="button"
              onClick={() => void generateAll()}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-label-sm text-neutral-600 hover:bg-neutral-50"
            >
              Generate All Images
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {benchmark.variants.map(v => (
              <VariantCard
                key={v.id}
                variant={v}
                benchmarkId={benchmark.id}
                isWinner={benchmark.winnerId === v.id}
                onGenerate={variant => void generateImage(variant)}
                onRatingSaved={onRatingSaved}
                onMarkWinner={onMarkWinner}
              />
            ))}
          </div>

          {/* Side-by-side comparison strip */}
          {benchmark.variants.some(v => v.imageUrl) && (
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <p className="mb-3 text-label-lg text-neutral-900">Side-by-Side Comparison</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {benchmark.variants.map(v => (
                  <div key={v.id} className="flex flex-col gap-2">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${VARIANT_COLORS[v.variantType] ?? ""}`}>
                      {v.variantLabel}
                    </span>
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.imageUrl}
                        alt={v.variantLabel}
                        className="w-full rounded-lg object-cover"
                        style={{ maxHeight: 200 }}
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 text-xs text-neutral-400">
                        {v.status === "generating" ? "Generating…" : "No image"}
                      </div>
                    )}
                    {v.rating && (
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>Overall</span>
                        <span className="font-semibold text-neutral-900">{v.rating.overallScore}/10</span>
                      </div>
                    )}
                    {benchmark.winnerId === v.id && (
                      <span className="text-xs font-semibold text-amber-600">★ Winner</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const [loading,        setLoading]      = React.useState(true);
  const [history,        setHistory]      = React.useState<BenchmarkSummary[]>([]);
  const [bestPerformers, setBestPerformers] = React.useState<BestPerformer[]>([]);
  const [error,          setError]        = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/prompt-lab/history");
        const json = (await res.json()) as {
          success: boolean;
          data?: { history: BenchmarkSummary[]; bestPerformers: BestPerformer[] };
          error?: { message?: string };
        };
        if (!json.success || !json.data) throw new Error(json.error?.message ?? "Failed to load history.");
        setHistory(json.data.history);
        setBestPerformers(json.data.bestPerformers);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="py-12 text-center text-body-sm text-neutral-400">Loading history…</div>;
  if (error)   return <p className="py-4 text-body-sm text-error">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* Best performers */}
      {bestPerformers.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-label-lg text-neutral-900">Top Performers (by Overall Score)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {bestPerformers.map(bp => (
              <div key={bp.variantId} className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600">{bp.variantLabel}</span>
                  <span className="text-label-sm font-bold text-neutral-900">{bp.score}/10</span>
                </div>
                {bp.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bp.imageUrl} alt={bp.variantLabel} className="w-full rounded-lg object-cover" style={{ maxHeight: 140 }} />
                )}
                <p className="text-xs text-neutral-500 line-clamp-2">{bp.rawIdea}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History list */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-4">
          <p className="text-label-lg text-neutral-900">Benchmark Sessions ({history.length})</p>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-8 text-body-sm text-neutral-400">No benchmark sessions yet. Run your first one from the New Benchmark tab.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="truncate text-body-sm text-neutral-900">{h.rawIdea}</p>
                  <p className="text-xs text-neutral-400">{h.industry} · {new Date(h.createdAt).toLocaleDateString()} · {h.generatedCount}/{h.variantCount} images · {h.ratedCount} rated</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {h.winnerId && <Badge variant="success" outline>winner set</Badge>}
                  <Badge variant="neutral" outline>{h.gptMode}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function LabPanel() {
  const [tab, setTab] = React.useState<"new" | "history">("new");

  const tabs = [
    { key: "new",     label: "New Benchmark" },
    { key: "history", label: "History & Dataset" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-200">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-label-sm transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-navy text-brand-navy"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "new"     && <NewBenchmarkTab />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
