"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

// ─── Type shapes returned by the API ─────────────────────────────────────────

interface DebugInfo {
  executionTimeMs:  number;
  model:            string | null;
  tokenUsage:       { prompt?: number; completion?: number; total?: number } | null;
  rawOutput:        string | null;
  retryCount:       number;
  promptSizeChars:  number;
  error:            string | null;
}

interface GPTNarrativeQuality {
  status:       "valid" | "partial" | "failed";
  score:        number;
  failedChecks: string[];
  checks:       Array<{ name: string; passed: boolean; reason: string }>;
}

interface GPTNarrative {
  narrativePrompt: string;
  quality:         GPTNarrativeQuality;
  fieldsConsumed:  string[];
  fieldsMissing:   string[];
}

interface Pipeline {
  creativeBrain: {
    awarenessLevel: string;
    storyFlow:      string;
    campaignGoal:   string;
    persuasion:     string;
    industry:       string;
  };
  gptDirection:  Record<string, unknown> | null;
  gptMode:       "gpt" | "fallback";
  gptDebug:      DebugInfo;
  promptSpec: {
    meta:        Record<string, unknown>;
    gptNarrative: GPTNarrative | null;
    mission:     { whatToGenerate: string; whyItMatters: string; nonNegotiableElement: string };
  };
  providerPrompt: {
    finalPrompt:   string;
    tokenCount:    number;
    promptLength:  number;
    qualityScore:  number;
    usedNarrative: boolean;
  };
  image: null;
}

interface DebugResult {
  mode:         "gpt" | "fallback";
  direction:    Record<string, unknown> | null;
  fallbackPlan: Record<string, unknown>;
  debug:        DebugInfo;
  pipeline:     Pipeline;
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

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

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-0">
      <span className="text-label-sm text-neutral-500">{label}</span>
      <span className="font-mono text-body-sm text-neutral-900">{value ?? "—"}</span>
    </div>
  );
}

function SectionCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-label-lg text-neutral-900">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <CopyButton text={text} />
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs text-neutral-700">
        {text}
      </pre>
    </div>
  );
}

// ─── Stage panels ─────────────────────────────────────────────────────────────

function Stage1CreativeBrain({ p }: { p: Pipeline }) {
  const cb = p.creativeBrain;
  return (
    <SectionCard
      title="Stage 1 — Creative Brain"
      badge={<Badge variant="neutral" outline>deterministic</Badge>}
    >
      <MetaRow label="Industry"        value={cb.industry} />
      <MetaRow label="Campaign Goal"   value={cb.campaignGoal} />
      <MetaRow label="Awareness Level" value={cb.awarenessLevel} />
      <MetaRow label="Story Arc"       value={cb.storyFlow} />
      <MetaRow label="Persuasion"      value={cb.persuasion} />
    </SectionCard>
  );
}

function Stage2GPTDirection({ p, fallbackPlan }: { p: Pipeline; fallbackPlan: Record<string, unknown> }) {
  const [tab, setTab] = React.useState<"json" | "raw" | "fallback">("json");
  const debug = p.gptDebug;

  const statusBadge =
    p.gptMode === "gpt"
      ? <Badge variant="success" outline>GPT</Badge>
      : <Badge variant="warning" outline>Fallback (deterministic)</Badge>;

  return (
    <SectionCard title="Stage 2 — GPT Creative Director" badge={statusBadge}>
      <div className="mb-4">
        <MetaRow label="Execution Time" value={`${debug.executionTimeMs} ms`} />
        <MetaRow label="Model"          value={debug.model ?? "unknown"} />
        <MetaRow label="Retry Count"    value={debug.retryCount} />
        <MetaRow label="Prompt Size"    value={`${debug.promptSizeChars.toLocaleString()} chars`} />
        <MetaRow label="Token Usage"    value={debug.tokenUsage ? JSON.stringify(debug.tokenUsage) : "not available"} />
        {debug.error && <MetaRow label="Error" value={<span className="text-error">{debug.error}</span>} />}
      </div>

      <div className="flex border-b border-neutral-200 mb-4">
        {[
          { key: "json",     label: "GPT Direction" },
          { key: "fallback", label: "Fallback Plan" },
          { key: "raw",      label: "Raw Output" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as typeof tab)}
            className={`px-4 py-2 text-label-sm transition-colors ${
              tab === key
                ? "border-b-2 border-brand-navy text-brand-navy"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "json" && (
        p.gptDirection
          ? <JsonBlock data={p.gptDirection} />
          : <p className="text-body-sm text-neutral-500">GPT direction not available — fallback was used.</p>
      )}
      {tab === "fallback" && <JsonBlock data={fallbackPlan} />}
      {tab === "raw" && (
        debug.rawOutput
          ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end"><CopyButton text={debug.rawOutput} /></div>
              <pre className="max-h-[520px] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs text-neutral-700">
                {debug.rawOutput}
              </pre>
            </div>
          )
          : <p className="text-body-sm text-neutral-500">No raw output — GPT not called or failed early.</p>
      )}
    </SectionCard>
  );
}

function Stage3PromptSpec({ p }: { p: Pipeline }) {
  const ps = p.promptSpec;
  const nar = ps.gptNarrative;

  const qualityBadge = nar
    ? nar.quality.status === "valid"
      ? <Badge variant="success" outline>quality valid ({nar.quality.score}%)</Badge>
      : nar.quality.status === "partial"
      ? <Badge variant="warning" outline>quality partial ({nar.quality.score}%)</Badge>
      : <Badge variant="error" outline>quality failed — fallback to section-based</Badge>
    : <Badge variant="neutral" outline>section-based (no GPT direction)</Badge>;

  return (
    <SectionCard title="Stage 3 — Prompt Specification" badge={qualityBadge}>
      {/* Mission summary */}
      <div className="mb-4">
        <MetaRow label="What to Generate"     value={ps.mission.whatToGenerate.slice(0, 120) + "…"} />
        <MetaRow label="Why It Matters"       value={ps.mission.whyItMatters.slice(0, 80) + "…"} />
        <MetaRow label="Non-Negotiable"       value={ps.mission.nonNegotiableElement.slice(0, 80) + "…"} />
        {nar && (
          <>
            <MetaRow label="Fields Consumed" value={nar.fieldsConsumed.length} />
            <MetaRow label="Fields Missing"  value={nar.fieldsMissing.length > 0 ? nar.fieldsMissing.join(", ") : "none"} />
          </>
        )}
      </div>

      {/* Quality checks */}
      {nar && (
        <div className="mb-4">
          <p className="mb-2 text-label-sm text-neutral-700">Quality Checks (7)</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {nar.quality.checks.map(c => (
              <div key={c.name} className={`flex items-start gap-2 rounded-lg px-3 py-2 ${c.passed ? "bg-success-light" : "bg-error-light"}`}>
                <span className={`mt-0.5 text-xs font-bold ${c.passed ? "text-success" : "text-error"}`}>
                  {c.passed ? "✓" : "✗"}
                </span>
                <div>
                  <span className="text-label-sm text-neutral-900">{c.name}</span>
                  <p className="text-xs text-neutral-500">{c.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative prompt */}
      {nar && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-label-sm text-neutral-700">GPT Narrative Prompt</span>
            <CopyButton text={nar.narrativePrompt} />
          </div>
          <pre className="max-h-[300px] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs text-neutral-700 whitespace-pre-wrap">
            {nar.narrativePrompt}
          </pre>
        </div>
      )}
    </SectionCard>
  );
}

function Stage4ProviderPrompt({ p }: { p: Pipeline }) {
  const pp = p.providerPrompt;
  return (
    <SectionCard
      title="Stage 4 — Provider Prompt (OpenAI)"
      badge={
        pp.usedNarrative
          ? <Badge variant="success" outline>GPT narrative used</Badge>
          : <Badge variant="neutral" outline>section-based assembly</Badge>
      }
    >
      <div className="mb-4">
        <MetaRow label="Prompt Length"  value={`${pp.promptLength.toLocaleString()} chars`} />
        <MetaRow label="Token Count"    value={`~${pp.tokenCount.toLocaleString()} tokens`} />
        <MetaRow label="Quality Score"  value={`${pp.qualityScore}/100`} />
        <MetaRow label="Prompt Mode"    value={pp.usedNarrative ? "GPT narrative" : "section-based"} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label-sm text-neutral-700">Final Prompt</span>
          <CopyButton text={pp.finalPrompt} />
        </div>
        <pre className="max-h-[400px] overflow-auto rounded-lg bg-neutral-50 p-4 text-xs text-neutral-700 whitespace-pre-wrap">
          {pp.finalPrompt}
        </pre>
      </div>
    </SectionCard>
  );
}

function Stage5Image() {
  return (
    <SectionCard title="Stage 5 — Image Generation">
      <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50">
        <p className="text-body-sm text-neutral-400">
          Image generation not run in debug mode. Use the main pipeline to generate.
        </p>
      </div>
    </SectionCard>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function CDDebugPanel() {
  const [idea, setIdea]         = React.useState("");
  const [loading, setLoading]   = React.useState(false);
  const [result, setResult]     = React.useState<DebugResult | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const handleRun = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setResult(null);
    setApiError(null);
    try {
      const res = await fetch("/api/admin/creative-director/debug", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idea: idea.trim() }),
      });
      const json = (await res.json()) as { success: boolean; data?: DebugResult; error?: string; message?: string };
      if (!json.success) {
        setApiError(json.message ?? json.error ?? "Unknown error");
      } else if (json.data) {
        setResult(json.data);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Input */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <label className="block text-label-sm text-neutral-700">Campaign Idea</label>
        <textarea
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-body-sm focus:border-brand-navy focus:outline-none"
          placeholder="e.g. Dental Implant — painless procedure, 15 years experience, 4.9 rating"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={loading || !idea.trim()}
            onClick={() => void handleRun()}
            className="rounded-lg bg-brand-navy px-4 py-2 text-label-sm text-white transition-opacity disabled:opacity-50"
          >
            {loading ? "Running pipeline…" : "Run Full Pipeline"}
          </button>
          {result && (
            <Badge variant={result.mode === "gpt" ? "success" : "warning"} outline>
              {result.mode === "gpt" ? "GPT Creative Director" : "Fallback (deterministic)"}
            </Badge>
          )}
        </div>
      </div>

      {apiError && (
        <div className="rounded-xl border border-error/30 bg-error-light px-4 py-3 text-body-sm text-error">
          {apiError}
        </div>
      )}

      {result?.pipeline && (
        <>
          <Stage1CreativeBrain p={result.pipeline} />
          <Stage2GPTDirection p={result.pipeline} fallbackPlan={result.fallbackPlan} />
          <Stage3PromptSpec p={result.pipeline} />
          <Stage4ProviderPrompt p={result.pipeline} />
          <Stage5Image />
        </>
      )}
    </div>
  );
}
