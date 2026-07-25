"use client";

import { useState, useCallback, useRef } from "react";
import {
  ChevronDown, ChevronRight, Copy, Check, Loader2,
  Brain, Search, AlertCircle, Zap, CheckCircle2, XCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StrategyField {
  value: string;
  confidence: "high" | "medium" | "low" | "unknown";
  reasoning: string;
}

interface UnderstandingField {
  value: string;
  confidence: "high" | "medium" | "low" | "unknown";
  reason: string;
}

interface IntelligenceField {
  value: string;
  confidence: string;
  reasoning: string;
  source: string;
}

interface InspectionResult {
  rawIdea: string;
  userUnderstanding: Record<string, unknown>;
  strategy: Record<string, unknown>;
  campaignPlan: Record<string, unknown>;
  layoutPlan: Record<string, unknown>;
  assetPlan: {
    assets: Array<{ id: string; priority: number; mandatory: boolean; commercialImportance: string; visualImportance: string }>;
    priority: string[];
    mandatory: string[];
    optional: string[];
    forbidden: string[];
  };
  composition: {
    strategyId: string;
    compositionGrade: string;
    totalAssets: number;
    crowdingScore?: number;
    whitespace: {
      globalPaddingPercent: number;
      sectionSpacingPercent: number;
      elementSpacingPercent: number;
      density: string;
      crowdingScore: number;
    };
    eyeFlow: {
      primary: string;
      secondary: string;
      tertiary: string;
      readingDirection: string;
      visualWeightOrder: string[];
      commercialWeightOrder: string[];
    };
    placements: Array<{ assetId: string; region: string; alignment: string; priority: number; prominence: string; stackOrder: number }>;
    warnings: string[];
  };
  copy: {
    headline: string;
    subheadline: string | null;
    benefits: string[];
    cta: string;
    secondaryCta: string | null;
    socialProof: string[];
    offer: string | null;
    badge: string | null;
    disclaimer: string | null;
    tone: { primary: string; secondary: string | null; formality: string; energyLevel: string };
    metadata: Record<string, unknown>;
  };
  typography: {
    typographyStyle: string;
    headline: { size: string; weight: string; contrast: string; alignment: string };
    cta: { size: string; weight: string; contrast: string };
    benefits: { size: string; weight: string; columns: number; bulletStyle: string };
    footer: { size: string; weight: string; contrast: string };
    spacing: { density: string; globalPadding: number; baseUnit: number };
  };
  blueprint: Record<string, unknown>;
  timing: {
    userUnderstanding: number;
    strategy: number;
    campaignPlan: number;
    layoutPlan: number;
    typographyPlan: number;
    assetPlan: number;
    composition: number;
    copy: number;
    typography: number;
    blueprint: number;
    total: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────────────────────────────────────

function confColor(c: string) {
  if (c === "high")   return "text-emerald-400";
  if (c === "medium") return "text-amber-400";
  if (c === "low")    return "text-orange-400";
  return "text-slate-500";
}

function confBg(c: string) {
  if (c === "high")   return "bg-emerald-950 text-emerald-300 border-emerald-800";
  if (c === "medium") return "bg-amber-950 text-amber-300 border-amber-800";
  if (c === "low")    return "bg-orange-950 text-orange-300 border-orange-800";
  return "bg-slate-800 text-slate-400 border-slate-700";
}

function confPct(c: string): number {
  if (c === "high")   return 92;
  if (c === "medium") return 60;
  if (c === "low")    return 28;
  return 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function ConfBadge({ confidence }: { confidence: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest ${confBg(confidence)}`}>
      {confidence}
    </span>
  );
}

function ConfBar({ confidence, pct }: { confidence: string; pct?: number }) {
  const p = pct ?? confPct(confidence);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${confidence === "high" ? "bg-emerald-500" : confidence === "medium" ? "bg-amber-500" : confidence === "low" ? "bg-orange-500" : "bg-slate-600"}`}
          style={{ width: `${p}%` }}
        />
      </div>
      <span className={`font-mono text-xs ${confColor(confidence)}`}>{p}%</span>
    </div>
  );
}

function Field({ label, field }: { label: string; field: StrategyField | UnderstandingField }) {
  const reasoning = "reasoning" in field ? field.reasoning : field.reason;
  return (
    <div className="group rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <ConfBadge confidence={field.confidence} />
      </div>
      <div className="mb-1.5 font-mono text-sm font-medium text-blue-300">
        {field.value || <span className="text-slate-600">unknown</span>}
      </div>
      <div className="font-mono text-[11px] leading-relaxed text-slate-500">{reasoning}</div>
      <div className="mt-2">
        <ConfBar confidence={field.confidence} />
      </div>
    </div>
  );
}

function PassFail({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${pass ? "border-emerald-800 bg-emerald-950" : "border-red-900 bg-red-950"}`}>
      {pass
        ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
        : <XCircle className="size-3.5 shrink-0 text-red-400" />
      }
      <span className={`font-mono text-xs font-medium ${pass ? "text-emerald-300" : "text-red-300"}`}>{label}</span>
      <span className={`ml-auto font-mono text-[10px] font-bold uppercase tracking-widest ${pass ? "text-emerald-500" : "text-red-500"}`}>
        {pass ? "PASS" : "FAIL"}
      </span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
    >
      {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      {copied ? "copied" : "copy"}
    </button>
  );
}

function VisualBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const filled = Math.round((value / max) * 12);
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 font-mono text-xs text-slate-400">{label}</span>
      <span className="font-mono text-xs text-blue-400">{"█".repeat(filled)}{"░".repeat(12 - filled)}</span>
      <span className="font-mono text-xs text-slate-500">{value}/{max}</span>
    </div>
  );
}

function Tag({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "must" | "never" | "optional" | "forbidden" }) {
  const cls = {
    default:   "border-slate-700 bg-slate-800 text-slate-300",
    must:      "border-emerald-800 bg-emerald-950 text-emerald-300",
    never:     "border-red-900 bg-red-950 text-red-300",
    optional:  "border-blue-900 bg-blue-950 text-blue-300",
    forbidden: "border-orange-900 bg-orange-950 text-orange-300",
  }[variant];
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section card (collapsible)
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  num, title, defaultOpen = false, status, children,
}: {
  num: string;
  title: string;
  defaultOpen?: boolean;
  status?: "pass" | "fail" | "warn" | "info";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const statusDot = {
    pass: "bg-emerald-500",
    fail: "bg-red-500",
    warn: "bg-amber-500",
    info: "bg-blue-500",
  }[status ?? "info"];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg shadow-black/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3.5 text-left transition hover:bg-slate-900"
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{num}</span>
        <span className="flex-1 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">{title}</span>
        {status && <span className={`size-2 shrink-0 rounded-full ${statusDot}`} />}
        {open
          ? <ChevronDown className="size-3.5 shrink-0 text-slate-600" />
          : <ChevronRight className="size-3.5 shrink-0 text-slate-600" />
        }
      </button>
      {open && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON viewer with search
// ─────────────────────────────────────────────────────────────────────────────

function JsonViewer({ data, label }: { data: unknown; label?: string }) {
  const [search, setSearch] = useState("");
  const json = JSON.stringify(data, null, 2);
  const lines = json.split("\n");

  const highlighted = search
    ? lines.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  const display = search
    ? highlighted.slice(0, 200)
    : lines.slice(0, 200);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <Search className="size-3 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${label ?? "JSON"}…`}
          className="flex-1 bg-transparent font-mono text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none"
        />
        {search && (
          <span className="font-mono text-[10px] text-slate-500">
            {highlighted.length} match{highlighted.length !== 1 ? "es" : ""}
          </span>
        )}
        <CopyBtn text={json} />
      </div>
      <div className="max-h-96 overflow-auto bg-slate-950 p-3">
        <pre className="font-mono text-[11px] leading-relaxed text-slate-400">
          {display.map((line, i) => {
            const isMatch = search && line.toLowerCase().includes(search.toLowerCase());
            return (
              <span key={i} className={isMatch ? "bg-yellow-900/30 text-yellow-300" : ""}>
                {line + "\n"}
              </span>
            );
          })}
          {lines.length > 200 && (
            <span className="text-slate-600">… {lines.length - 200} more lines (copy to see full JSON)</span>
          )}
        </pre>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASCII Composition Layout
// ─────────────────────────────────────────────────────────────────────────────

function AsciiLayout({ composition }: { composition: InspectionResult["composition"] }) {
  const placements = composition.placements ?? [];
  const heroZone = "hero_zone";

  // Map region → label
  const regionMap: Record<string, string> = {};
  regionMap[heroZone] = "◈ HERO IMAGE";
  for (const p of placements) {
    const label = p.assetId.replace(/_/g, " ").toUpperCase();
    if (!regionMap[p.region]) {
      regionMap[p.region] = label;
    } else {
      regionMap[p.region] += " · " + label;
    }
  }

  // Build a simple region grid
  const zones: [string, string][] = [
    ["top_left / top_center / top_right", "LOGO · OFFER · BADGE"],
    ["above_cta / hero_zone",             regionMap["hero_zone"] ?? "◈ HERO IMAGE"],
    ["below_headline",                    regionMap["below_headline"] ?? "HEADLINE"],
    ["mid_center / mid_left / mid_right", regionMap["mid_center"] ?? regionMap["mid_left"] ?? "BENEFITS"],
    ["above_cta",                         regionMap["above_cta"] ?? "SOCIAL PROOF"],
    ["bottom_center",                     regionMap["bottom_center"] ?? "CTA"],
    ["footer_left / footer_center",       regionMap["footer_center"] ?? regionMap["footer_left"] ?? "FOOTER"],
  ];

  // Use eye flow order for display
  const flowOrder = [
    composition.eyeFlow?.primary,
    composition.eyeFlow?.secondary,
    composition.eyeFlow?.tertiary,
  ].filter(Boolean);

  const flowLabels = flowOrder.map((id, i) => `${i + 1}. ${String(id).replace(/_/g, " ")}`);

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="font-mono text-[10px] text-slate-500 mb-2 uppercase tracking-widest">Layout ({composition.strategyId})</div>
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs">
          <div className="text-slate-600">╔{"═".repeat(36)}╗</div>
          {zones.map(([, label], i) => (
            <div key={i} className="flex">
              <span className="text-slate-600">║ </span>
              <span className="flex-1 truncate text-slate-300">{label.padEnd(34)}</span>
              <span className="text-slate-600"> ║</span>
            </div>
          ))}
          <div className="text-slate-600">╚{"═".repeat(36)}╝</div>
        </div>
      </div>
      <div className="w-48 shrink-0">
        <div className="font-mono text-[10px] text-slate-500 mb-2 uppercase tracking-widest">Eye Flow</div>
        <div className="space-y-1">
          {flowLabels.map((l, i) => (
            <div key={i} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 font-mono text-xs text-blue-300">{l}</div>
          ))}
          <div className="mt-2 font-mono text-[10px] text-slate-500">
            Direction: {composition.eyeFlow?.readingDirection ?? "ltr"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function BrainInspector() {
  const [idea, setIdea] = useState("Luxury dental implant clinic in Mumbai with 15 years experience");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/creative-brain-inspector", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idea }),
      });
      const data = (await res.json()) as { success: boolean; data?: InspectionResult; error?: { message: string } };
      if (!data.success || !data.data) {
        setError(data.error?.message ?? "Unknown error");
      } else {
        setResult(data.data);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [idea]);

  const uu   = result?.userUnderstanding as Record<string, unknown> | undefined;
  const strat = result?.strategy as Record<string, unknown> | undefined;
  const cp    = result?.campaignPlan as Record<string, unknown> | undefined;
  const lp    = result?.layoutPlan as Record<string, unknown> | undefined;

  // Helper: safely get a StrategyField from nested path
  function sf(obj: unknown, ...path: string[]): StrategyField | null {
    let cur: unknown = obj;
    for (const k of path) {
      if (typeof cur !== "object" || cur === null) return null;
      cur = (cur as Record<string, unknown>)[k];
    }
    if (typeof cur !== "object" || cur === null) return null;
    const o = cur as Record<string, unknown>;
    return { value: String(o.value ?? ""), confidence: String(o.confidence ?? "") as "high", reasoning: String(o.reasoning ?? o.reason ?? "") };
  }

  function uf(obj: unknown, key: string): UnderstandingField | null {
    if (typeof obj !== "object" || obj === null) return null;
    const v = (obj as Record<string, unknown>)[key];
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    return { value: String(o.value ?? ""), confidence: String(o.confidence ?? "") as "high", reason: String(o.reason ?? "") };
  }

  // Validation checks
  const validations = result ? {
    industry:    (sf(strat, "business", "industry")?.confidence ?? "unknown") !== "unknown",
    campaign:    (sf(strat, "marketing", "campaignGoal")?.confidence ?? "unknown") !== "unknown",
    route:       (sf(strat, "campaign", "storyFlow")?.confidence ?? "unknown") !== "unknown",
    rules:       !!result.campaignPlan,
    assets:      result.assetPlan.mandatory.length > 0,
    composition: result.composition.compositionGrade !== "D",
    typography:  !!result.typography.headline,
    blueprint:   !!result.blueprint,
  } : null;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl shadow-black/50">
        <div className="border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-blue-900 bg-blue-950">
              <Brain className="size-4 text-blue-400" />
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold tracking-wide text-slate-100">CREATIVE BRAIN INSPECTOR</h1>
              <p className="font-mono text-[10px] text-slate-500">ADMIN · DETERMINISTIC ONLY · NO GPT · NO OPENAI COST</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="font-mono text-[10px] text-emerald-500">DETERMINISTIC</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-slate-500">Raw Idea</label>
              <textarea
                value={idea}
                onChange={e => setIdea(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run(); }}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-800"
                placeholder="Enter a creative idea to inspect…"
              />
              <p className="mt-1 font-mono text-[10px] text-slate-600">⌘↵ to run · Ctrl+↵ to run</p>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <button
                onClick={() => void run()}
                disabled={loading || !idea.trim()}
                className="flex h-10 items-center gap-2 rounded-lg border border-blue-800 bg-blue-900 px-5 font-mono text-xs font-semibold text-blue-200 transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                {loading ? "Running…" : "Inspect"}
              </button>
              {result && (
                <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-emerald-500">
                  <Check className="size-3" />
                  {result.timing.total.toFixed(1)}ms
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-900 bg-red-950 px-3 py-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
              <p className="font-mono text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950 py-16">
          <Loader2 className="size-5 animate-spin text-blue-400" />
          <span className="font-mono text-sm text-slate-400">Running deterministic pipeline…</span>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="space-y-3">

          {/* ── S1: Raw Input ── */}
          <SectionCard num="01" title="Raw Input" defaultOpen status="info">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="col-span-full rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Raw Idea</div>
                <p className="font-mono text-sm text-blue-300">{result.rawIdea}</p>
              </div>

              {uf(uu, "language") && (
                <Field label="Detected Language" field={uf(uu, "language")!} />
              )}
              {uf(uu, "intent") && (
                <Field label="Intent Type" field={uf(uu, "intent")!} />
              )}
              {uf(uu, "businessGoal") && (
                <Field label="Business Goal" field={uf(uu, "businessGoal")!} />
              )}
              {uf(uu, "urgency") && (
                <Field label="Urgency Signal" field={uf(uu, "urgency")!} />
              )}

              {/* Extracted signals */}
              {(() => {
                const detectedOffer = (uu as Record<string, unknown>)?.detectedOffer as Record<string, unknown> | undefined;
                const painPoints    = (uu as Record<string, unknown>)?.extractedPainPoints as unknown[] | undefined;
                const usps          = (uu as Record<string, unknown>)?.extractedUsp as unknown[] | undefined;
                const authority     = (uu as Record<string, unknown>)?.authoritySignals as unknown[] | undefined;
                return (
                  <>
                    {detectedOffer && String(detectedOffer.offerType) !== "none" && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Detected Offer</div>
                        <div className="font-mono text-sm text-emerald-300">{String(detectedOffer.offerValue ?? detectedOffer.offerType)}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500">{String(detectedOffer.reasoning ?? "")}</div>
                      </div>
                    )}
                    {(painPoints?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Pain Points Extracted</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(painPoints as Array<Record<string, unknown>>).map((p, i) => (
                            <Tag key={i} variant="never">{String(p.value)}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {(usps?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">USPs Extracted</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(usps as Array<Record<string, unknown>>).map((u, i) => (
                            <Tag key={i} variant="must">{String(u.value)}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {(authority?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Authority Signals</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(authority as Array<Record<string, unknown>>).map((a, i) => (
                            <Tag key={i} variant="optional">{String(a.type)}: {String(a.value)}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </SectionCard>

          {/* ── S2: Industry Detection ── */}
          <SectionCard num="02" title="Industry Detection" defaultOpen
            status={sf(strat, "business", "industry")?.confidence === "high" ? "pass" : "warn"}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sf(strat, "business", "industry") && (
                <Field label="Primary Industry" field={sf(strat, "business", "industry")!} />
              )}
              {sf(strat, "business", "subIndustry") && (
                <Field label="Sub Industry" field={sf(strat, "business", "subIndustry")!} />
              )}
              {sf(strat, "business", "businessType") && (
                <Field label="Business Type" field={sf(strat, "business", "businessType")!} />
              )}
              {sf(strat, "business", "businessGoal") && (
                <Field label="Business Goal" field={sf(strat, "business", "businessGoal")!} />
              )}

              {/* Alternative industry signals from UU */}
              <div className="col-span-full">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Detection Signal</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[uf(uu, "industry"), uf(uu, "subIndustry"), uf(uu, "businessCategory")].map((f, i) => f && (
                      <div key={i} className="text-center">
                        <div className="font-mono text-sm font-medium text-blue-300">{f.value}</div>
                        <ConfBar confidence={f.confidence} />
                        <div className="mt-1 font-mono text-[10px] text-slate-500 uppercase">{["industry", "sub-industry", "category"][i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── S3: Campaign Analysis ── */}
          <SectionCard num="03" title="Campaign Analysis" defaultOpen
            status={sf(strat, "marketing", "campaignGoal")?.confidence === "high" ? "pass" : "warn"}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                { label: "Campaign Goal",           path: ["marketing", "campaignGoal"] },
                { label: "Campaign Type",           path: ["campaign", "campaignCategory"] },
                { label: "Awareness Level",         path: ["audience", "awarenessLevel"] },
                { label: "Communication Style",     path: ["communication", "communicationStyle"] },
                { label: "Luxury Level",            path: ["visual", "luxuryLevel"] },
                { label: "Brand Type",              path: ["business", "businessType"] },
                { label: "Buyer Stage",             path: ["audience", "buyerStage"] },
                { label: "Buying Intent",           path: ["audience", "buyingIntent"] },
                { label: "Persuasion Approach",     path: ["communication", "persuasionApproach"] },
                { label: "Conversion Priority",     path: ["marketing", "conversionPriority"] },
                { label: "Story Flow",              path: ["campaign", "storyFlow"] },
                { label: "Emotional Direction",     path: ["audience", "desires"] },
                { label: "Commercial Style",        path: ["business", "competitivePosition"] },
              ].map(({ label, path }) => {
                const f = sf(strat, ...path);
                return f ? <Field key={label} label={label} field={f} /> : null;
              })}

              {/* Customer Awareness (UU Phase 2) */}
              {(() => {
                const ca = (uu as Record<string, unknown>)?.customerAwareness as Record<string, unknown> | undefined;
                if (!ca) return null;
                const field: StrategyField = { value: String(ca.value), confidence: String(ca.confidence) as "high", reasoning: String(ca.reasoning) };
                return <Field key="ca" label="Customer Awareness (Schwartz)" field={field} />;
              })()}
            </div>
          </SectionCard>

          {/* ── S4: Route Engine ── */}
          <SectionCard num="04" title="Route Engine"
            status={sf(strat, "campaign", "storyFlow")?.confidence === "high" ? "pass" : "warn"}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {sf(strat, "campaign", "storyFlow") && (
                  <Field label="Selected Story Flow / Route" field={sf(strat, "campaign", "storyFlow")!} />
                )}
                {sf(strat, "creative", "creativeCategory") && (
                  <Field label="Creative Category" field={sf(strat, "creative", "creativeCategory")!} />
                )}
              </div>

              {/* Story flow nodes */}
              {(() => {
                const nodes = (strat as Record<string, unknown>)?.campaign as Record<string, unknown> | undefined;
                const flowNodes = nodes?.storyFlowNodes as Array<Record<string, unknown>> | undefined;
                if (!flowNodes?.length) return null;
                return (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">Story Flow Nodes</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {flowNodes.map((node, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="flex flex-col items-center">
                            <div className="rounded border border-blue-900 bg-blue-950 px-2 py-1 font-mono text-[10px] text-blue-300">
                              {String(node.id ?? node.name ?? i + 1)}
                            </div>
                            <div className="font-mono text-[9px] text-slate-600 mt-0.5">{String(node.intent ?? "")}</div>
                          </div>
                          {i < flowNodes.length - 1 && (
                            <span className="font-mono text-slate-700">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </SectionCard>

          {/* ── S5: Creative Decision Engine ── */}
          <SectionCard num="05" title="Creative Decision Engine"
            status={sf(strat, "creative", "heroSubject")?.confidence === "high" ? "pass" : "warn"}>
            <div className="space-y-4">
              {/* Visual priority bars */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">Visual Priority Stack</div>
                <div className="space-y-2">
                  {[
                    { label: "Hero Subject",       value: 10, key: ["creative", "heroSubject"] },
                    { label: "Photography Style",  value: sf(strat, "visual", "photographyStyle")?.confidence === "high" ? 10 : sf(strat, "visual", "photographyStyle")?.confidence === "medium" ? 8 : 5 },
                    { label: "Marketing Strength", value: sf(strat, "marketing", "campaignGoal")?.confidence === "high" ? 9 : 7 },
                    { label: "Typography",         value: sf(strat, "communication", "communicationStyle")?.confidence === "high" ? 8 : 6 },
                    { label: "Environment",        value: sf(strat, "visual", "environmentPriority")?.confidence === "high" ? 8 : 6 },
                    { label: "Commercial Assets",  value: result.assetPlan.mandatory.length >= 4 ? 7 : 5 },
                    { label: "Composition",        value: result.composition.compositionGrade === "A" ? 9 : result.composition.compositionGrade === "B" ? 7 : 5 },
                    { label: "Negative Space",     value: result.composition.whitespace.density === "sparse" ? 9 : result.composition.whitespace.density === "balanced" ? 7 : 4 },
                  ].map(item => (
                    <VisualBar key={item.label} label={item.label} value={item.value ?? 5} />
                  ))}
                </div>
              </div>

              {/* Non-negotiables */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {sf(strat, "creative", "heroSubject") && (
                  <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-blue-600">NON-NEGOTIABLE: Hero Subject</div>
                    <div className="font-mono text-sm font-medium text-blue-300">{sf(strat, "creative", "heroSubject")?.value}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">{sf(strat, "creative", "heroSubject")?.reasoning}</div>
                  </div>
                )}
                {sf(strat, "visual", "photographyStyle") && (
                  <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-blue-600">NON-NEGOTIABLE: Photography</div>
                    <div className="font-mono text-sm font-medium text-blue-300">{sf(strat, "visual", "photographyStyle")?.value}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">{sf(strat, "visual", "photographyStyle")?.reasoning}</div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── S6: Rule Engine ── */}
          <SectionCard num="06" title="Rule Engine" status="info">
            <div className="space-y-3">
              {/* MUST rules from creative constraints */}
              {(() => {
                const constraints = (cp as Record<string, unknown>)?.creativeConstraints as Record<string, unknown> | undefined;
                if (!constraints) return <p className="font-mono text-xs text-slate-500">Campaign plan not yet available.</p>;

                const mustAlways = constraints.mustAlwaysAppear as Record<string, unknown> | undefined;
                const mustNever  = constraints.mustNeverAppear  as Record<string, unknown> | undefined;
                const brandSafe  = constraints.brandSafety      as Record<string, unknown> | undefined;
                const industryR  = constraints.industryRestrictions as Record<string, unknown> | undefined;

                return (
                  <>
                    {mustAlways && (
                      <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-600">MUST ALWAYS APPEAR</span>
                          <ConfBadge confidence={String(mustAlways.confidence)} />
                        </div>
                        <div className="font-mono text-sm font-medium text-emerald-300">{String(mustAlways.value)}</div>
                        <div className="mt-2 font-mono text-[11px] text-slate-500">{String(mustAlways.reasoning)}</div>
                      </div>
                    )}
                    {mustNever && (
                      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-red-600">MUST NEVER APPEAR</span>
                          <ConfBadge confidence={String(mustNever.confidence)} />
                        </div>
                        <div className="font-mono text-sm font-medium text-red-300">{String(mustNever.value)}</div>
                        <div className="mt-2 font-mono text-[11px] text-slate-500">{String(mustNever.reasoning)}</div>
                      </div>
                    )}
                    {brandSafe && (
                      <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
                        <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-600">BRAND SAFETY</div>
                        <div className="font-mono text-sm text-amber-300">{String(brandSafe.value)}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500">{String(brandSafe.reasoning)}</div>
                      </div>
                    )}
                    {industryR && (
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">INDUSTRY RESTRICTIONS</div>
                        <div className="font-mono text-sm text-slate-300">{String(industryR.value)}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500">{String(industryR.reasoning)}</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </SectionCard>

          {/* ── S7: Knowledge Library ── */}
          <SectionCard num="07" title="Creative Knowledge Library (CKL)" status="pass">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { label: "Industry Module",       loaded: !!sf(strat, "business", "industry") },
                { label: "Campaign Module",       loaded: !!sf(strat, "marketing", "campaignGoal") },
                { label: "Story Flow Pattern",    loaded: !!sf(strat, "campaign", "storyFlow") },
                { label: "Gold Standards",        loaded: !!sf(strat, "visual", "luxuryLevel") },
                { label: "Anti-Patterns",         loaded: !!cp },
                { label: "Design Heuristics",     loaded: !!result.layoutPlan },
                { label: "Asset Registry",        loaded: result.assetPlan.assets.length > 0 },
                { label: "Composition Strategies",loaded: !!result.composition.strategyId },
                { label: "Typography Rules",      loaded: !!result.typography.typographyStyle },
                { label: "Copy Templates",        loaded: !!result.copy.headline },
                { label: "Industry Rules",        loaded: result.assetPlan.mandatory.length > 0 },
                { label: "Brand Safety Rules",    loaded: !!cp },
              ].map(({ label, loaded }) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${loaded ? "border-emerald-900/60 bg-emerald-950/20" : "border-slate-800 bg-slate-900/60"}`}
                >
                  {loaded
                    ? <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
                    : <XCircle className="size-3 shrink-0 text-slate-600" />
                  }
                  <span className={`font-mono text-[10px] leading-tight ${loaded ? "text-emerald-300" : "text-slate-500"}`}>{label}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── S8: Asset Planner ── */}
          <SectionCard num="08" title="Asset Planner"
            status={result.assetPlan.mandatory.length > 0 ? "pass" : "warn"}>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
                  <div className="font-mono text-2xl font-bold text-blue-400">{result.assetPlan.assets.length}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Total Assets</div>
                </div>
                <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3 text-center">
                  <div className="font-mono text-2xl font-bold text-emerald-400">{result.assetPlan.mandatory.length}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-600">Mandatory</div>
                </div>
                <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-center">
                  <div className="font-mono text-2xl font-bold text-red-400">{result.assetPlan.forbidden.length}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-red-600">Forbidden</div>
                </div>
              </div>

              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Priority Order</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.assetPlan.priority.slice(0, 12).map((id, i) => (
                    <div key={id} className="flex items-center gap-1">
                      <span className="font-mono text-[9px] text-slate-600">{i + 1}.</span>
                      <Tag variant={result.assetPlan.mandatory.includes(id) ? "must" : "optional"}>
                        {id.replace(/_/g, " ")}
                      </Tag>
                    </div>
                  ))}
                </div>
              </div>

              {result.assetPlan.forbidden.length > 0 && (
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Forbidden Assets</div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.assetPlan.forbidden.map(id => (
                      <Tag key={id} variant="forbidden">{id.replace(/_/g, " ")}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── S9: Copy Intelligence ── */}
          <SectionCard num="09" title="Copy Intelligence"
            status={result.copy.headline ? "pass" : "fail"}>
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-900/40 bg-blue-950/10 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Headline</div>
                <div className="font-mono text-base font-bold text-blue-200">&quot;{result.copy.headline}&quot;</div>
                {result.copy.subheadline && (
                  <div className="mt-1 font-mono text-sm text-slate-400">&quot;{result.copy.subheadline}&quot;</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">CTA</div>
                  <div className="font-mono text-sm font-semibold text-emerald-300">&quot;{result.copy.cta}&quot;</div>
                  {result.copy.secondaryCta && (
                    <div className="mt-1 font-mono text-xs text-slate-500">Secondary: &quot;{result.copy.secondaryCta}&quot;</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Tone</div>
                  <div className="space-y-0.5">
                    <div className="font-mono text-sm text-blue-300">{result.copy.tone.primary}</div>
                    <div className="font-mono text-xs text-slate-500">Formality: {result.copy.tone.formality}</div>
                    <div className="font-mono text-xs text-slate-500">Energy: {result.copy.tone.energyLevel}</div>
                  </div>
                </div>
              </div>

              {result.copy.benefits.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Benefits ({result.copy.benefits.length})</div>
                  <ul className="space-y-1">
                    {result.copy.benefits.map((b, i) => (
                      <li key={i} className="font-mono text-xs text-slate-300">– {b}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {result.copy.offer && (
                  <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-amber-600 mb-1">Offer</div>
                    <div className="font-mono text-xs text-amber-300">{result.copy.offer}</div>
                  </div>
                )}
                {result.copy.socialProof.length > 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Social Proof</div>
                    <div className="font-mono text-xs text-slate-300">{result.copy.socialProof[0]}</div>
                  </div>
                )}
                {result.copy.disclaimer && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-1">Disclaimer</div>
                    <div className="font-mono text-[10px] text-slate-400 leading-relaxed">{result.copy.disclaimer}</div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* ── S10: Composition Engine ── */}
          <SectionCard num="10" title="Composition Engine"
            status={result.composition.compositionGrade === "A" ? "pass" : result.composition.compositionGrade === "D" ? "fail" : "warn"}>
            <div className="space-y-4">
              <AsciiLayout composition={result.composition} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Whitespace",  value: Math.max(0, 100 - result.composition.whitespace.crowdingScore), suffix: "%" },
                  { label: "Crowding",    value: result.composition.whitespace.crowdingScore, suffix: "%" },
                  { label: "Density",     value: result.composition.whitespace.density, suffix: "" },
                  { label: "Grade",       value: result.composition.compositionGrade, suffix: "" },
                ].map(({ label, value, suffix }) => (
                  <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
                    <div className={`font-mono text-xl font-bold ${typeof value === "number" && value > 60 && label === "Crowding" ? "text-red-400" : "text-blue-400"}`}>
                      {value}{suffix}
                    </div>
                  </div>
                ))}
              </div>

              {result.composition.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-600">Composition Warnings</div>
                  {result.composition.warnings.map((w, i) => (
                    <div key={i} className="font-mono text-xs text-amber-300">– {w}</div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* ── S11: Typography ── */}
          <SectionCard num="11" title="Typography Plan"
            status={result.typography.headline ? "pass" : "warn"}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { role: "Headline", data: result.typography.headline },
                { role: "CTA",      data: result.typography.cta },
                { role: "Benefits", data: result.typography.benefits },
                { role: "Footer",   data: result.typography.footer },
              ].map(({ role, data }) => data && (
                <div key={role} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">{role}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-slate-500">size</span>
                      <span className="text-blue-300">{data.size}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-slate-500">weight</span>
                      <span className="text-blue-300">{data.weight}</span>
                    </div>
                    {"contrast" in data && (
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-slate-500">contrast</span>
                        <span className={confColor(String(data.contrast) === "ultra_high" || String(data.contrast) === "high" ? "high" : String(data.contrast) === "medium" ? "medium" : "low")}>
                          {String(data.contrast)}
                        </span>
                      </div>
                    )}
                    {"alignment" in data && (
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-slate-500">alignment</span>
                        <span className="text-slate-300">{String(data.alignment)}</span>
                      </div>
                    )}
                    {"columns" in data && (
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-slate-500">columns</span>
                        <span className="text-slate-300">{String((data as { columns: number }).columns)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Style</div>
                <div className="font-mono text-sm text-blue-300">{result.typography.typographyStyle}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Density</div>
                <div className="font-mono text-sm text-blue-300">{result.typography.spacing.density}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Base Unit</div>
                <div className="font-mono text-sm text-blue-300">{result.typography.spacing.baseUnit}px</div>
              </div>
            </div>
          </SectionCard>

          {/* ── S12: Blueprint JSON ── */}
          <SectionCard num="12" title="Final Blueprint (Read-Only JSON)" status="pass">
            <JsonViewer data={result.blueprint} label="UniversalCampaignBlueprint" />
          </SectionCard>

          {/* ── S13: Performance ── */}
          <SectionCard num="13" title="Performance" defaultOpen status="info">
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-900/40 bg-blue-950/10 p-3 text-center">
                <div className="font-mono text-3xl font-bold text-blue-400">{result.timing.total.toFixed(2)}<span className="text-lg text-slate-500">ms</span></div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Total Execution Time</div>
                <div className="mt-1 font-mono text-[10px] text-slate-600">Zero GPT calls · Zero API cost · 100% deterministic</div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-800">
                <div className="grid grid-cols-[1fr_auto_auto] border-b border-slate-800 bg-slate-900 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  <span>Module</span>
                  <span className="text-right">Time</span>
                  <span className="w-24 text-right">Share</span>
                </div>
                {(Object.entries(result.timing) as [string, number][])
                  .filter(([k]) => k !== "total")
                  .sort(([, a], [, b]) => b - a)
                  .map(([module, ms]) => {
                    const pct = (ms / result.timing.total) * 100;
                    return (
                      <div key={module} className="grid grid-cols-[1fr_auto_auto] items-center border-b border-slate-800/60 px-3 py-2 last:border-0 hover:bg-slate-900">
                        <span className="font-mono text-xs text-slate-300">{module.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className="font-mono text-xs text-blue-400 tabular-nums">{ms.toFixed(2)}ms</span>
                        <div className="ml-4 flex w-24 items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Blueprint Size", value: `${(JSON.stringify(result.blueprint).length / 1024).toFixed(1)} KB` },
                  { label: "GPT Calls",      value: "0" },
                  { label: "AI Cost",        value: "$0.00" },
                  { label: "Cache",          value: "DETERMINISTIC" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
                    <div className="font-mono text-sm font-semibold text-blue-400">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ── S14: Validation ── */}
          <SectionCard num="14" title="Validation" defaultOpen
            status={validations && Object.values(validations).every(Boolean) ? "pass" : "fail"}>
            {validations && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <PassFail pass={validations.industry}    label="Industry Detection" />
                  <PassFail pass={validations.campaign}    label="Campaign Goal" />
                  <PassFail pass={validations.route}       label="Route / Story Flow" />
                  <PassFail pass={validations.rules}       label="Rule Engine" />
                  <PassFail pass={validations.assets}      label="Asset Planner (mandatory > 0)" />
                  <PassFail pass={validations.composition} label="Composition Grade (not D)" />
                  <PassFail pass={validations.typography}  label="Typography Plan" />
                  <PassFail pass={validations.blueprint}   label="Blueprint Assembly" />
                </div>

                <div className={`mt-3 rounded-lg border p-3 text-center ${Object.values(validations).every(Boolean) ? "border-emerald-800 bg-emerald-950" : "border-red-900 bg-red-950"}`}>
                  <div className={`font-mono text-lg font-bold ${Object.values(validations).every(Boolean) ? "text-emerald-300" : "text-red-300"}`}>
                    {Object.values(validations).filter(Boolean).length} / {Object.values(validations).length} checks passed
                  </div>
                  <div className={`font-mono text-[10px] uppercase tracking-widest mt-1 ${Object.values(validations).every(Boolean) ? "text-emerald-600" : "text-red-600"}`}>
                    {Object.values(validations).every(Boolean) ? "✓ CREATIVE BRAIN PIPELINE VALIDATED" : "⚠ SOME CHECKS FAILED — REVIEW ABOVE"}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

        </div>
      )}
    </div>
  );
}
