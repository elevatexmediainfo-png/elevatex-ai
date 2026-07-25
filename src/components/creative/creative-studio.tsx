"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles,
  Wand2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Shuffle,
  RotateCcw,
} from "lucide-react";

import { PRESETS_BY_KIND } from "@/lib/validations/creative";
import {
  AssetUploadTile,
  type AssetUploadValue,
  type RecentReferenceOption,
} from "@/components/creative/asset-upload-tile";
import { type AspectRatioValue } from "@/components/creative/aspect-ratio-selector";
import { PromptPreviewPanel } from "@/components/creative/prompt-preview-panel";
import { HERO_HANDOFF_KEY, type HeroHandoff } from "@/lib/dashboard/hero-handoff";
import type { UniversalPrompt } from "@/lib/prompt-os/schema";

import { GenerationProgress } from "@/components/creative/workspace/generation-progress";
import { CanvasEmptyState } from "@/components/creative/workspace/canvas-empty-state";
import { CanvasToolbar } from "@/components/creative/workspace/canvas-toolbar";
import { GenerationsGrid } from "@/components/creative/workspace/generations-grid";
import { StudioAspectRatio } from "@/components/creative/workspace/studio-aspect-ratio";
import { GradientButton } from "@/components/shared/gradient-button";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Kind = keyof typeof PRESETS_BY_KIND;
type Step = "input" | "enhancing" | "preview" | "generating" | "result";

interface ResultProject {
  id: string;
  title: string;
  resultUrl: string | null;
}

interface CreativeStudioProps {
  kind: Kind;
  initialPresetKey?: string;
  estimatedSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy per kind
// ─────────────────────────────────────────────────────────────────────────────

const TITLES: Record<Kind, { title: string; subtitle: string; placeholder: string }> = {
  AI_IMAGE: {
    title: "AI Image",
    subtitle: "Transform your idea into a professional AI image",
    placeholder: "Describe the image you want to create...",
  },
  SOCIAL_MEDIA: {
    title: "Social Media Creative",
    subtitle: "Generate platform-shaped graphics for Instagram, Facebook, Pinterest, and more",
    placeholder: "Describe the social post you want to create...",
  },
  MARKETING_CREATIVE: {
    title: "Marketing Creative",
    subtitle: "Generate print and web collateral — posters, flyers, banners, and more",
    placeholder: "Describe the marketing asset you want to create...",
  },
};

// Estimated seconds for the enhance step (used in canvas animation only)
const ENHANCE_ESTIMATED_SECONDS = 6;
const ENHANCE_WITH_REFERENCE_ESTIMATED_SECONDS = 14;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

// Milestone 4 — Premium AI workspace. Two-panel layout:
// LEFT: prompt + controls (sticky on desktop).
// RIGHT: canvas that morphs across all five generation steps.
// Business logic (state machine, API calls, hero-handoff) is preserved
// verbatim from the Milestone 15 original; only the JSX tree is replaced.
export function CreativeStudio({ kind, initialPresetKey, estimatedSeconds }: CreativeStudioProps) {
  const copy = TITLES[kind];
  const presets = PRESETS_BY_KIND[kind];

  // ── All state from the original component ──────────────────────────────────
  const [idea, setIdea] = React.useState("");
  const [negativePrompt, setNegativePrompt] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [reference, setReference] = React.useState<AssetUploadValue | null>(null);
  const [logo, setLogo] = React.useState<AssetUploadValue | null>(null);
  const [savedLogo, setSavedLogo] = React.useState<{ assetId: string; url: string; label: string } | undefined>();
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatioValue>({
    presetKey:
      initialPresetKey && presets.some((p) => p.key === initialPresetKey)
        ? initialPresetKey
        : (presets[0]?.key ?? ""),
  });
  const [enhancedPrompt, setEnhancedPrompt] = React.useState("");
  const [universalPrompt, setUniversalPrompt] = React.useState<UniversalPrompt | undefined>(undefined);
  const [recentReferences, setRecentReferences] = React.useState<RecentReferenceOption[]>([]);
  const [step, setStep] = React.useState<Step>("input");
  const [result, setResult] = React.useState<ResultProject | null>(null);
  const [isVariationMode, setIsVariationMode] = React.useState(false);

  // ── UI-only state ──────────────────────────────────────────────────────────
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = React.useState(false);

  // Auto-resize the textarea as the user types
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [idea]);

  // ── Effects: brand kit + recent references (identical to original) ─────────
  React.useEffect(() => {
    fetch("/api/brand-kit")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data.brandKit?.logoAssetId && json.data.logoUrl) {
          setSavedLogo({ assetId: json.data.brandKit.logoAssetId, url: json.data.logoUrl, label: "my brand logo" });
        }
      })
      .catch(() => {});

    fetch("/api/design-intelligence/recent-references")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setRecentReferences(
            json.data.references.map(
              (r: { assetId: string; url: string; label: string | null; style: string | null }) => ({
                assetId: r.assetId,
                url: r.url,
                label: r.label ?? r.style ?? "reference",
              }),
            ),
          );
        }
      })
      .catch(() => {});
  }, []);

  // ── Hero handoff (identical to original) ──────────────────────────────────
  React.useEffect(() => {
    const raw = sessionStorage.getItem(HERO_HANDOFF_KEY);
    if (!raw) return;
    sessionStorage.removeItem(HERO_HANDOFF_KEY);
    try {
      const handoff = JSON.parse(raw) as HeroHandoff;
      if (handoff.idea) setIdea(handoff.idea);
      if (handoff.reference) setReference(handoff.reference);
      if (handoff.logo) setLogo(handoff.logo);
      if (handoff.enhancedPrompt) {
        setEnhancedPrompt(handoff.enhancedPrompt);
        setUniversalPrompt(handoff.universalPrompt as UniversalPrompt | undefined);
        if (handoff.presetKey && presets.some((p) => p.key === handoff.presetKey)) {
          setAspectRatio({ presetKey: handoff.presetKey });
        }
        void handleGenerate({
          enhancedPrompt: handoff.enhancedPrompt,
          universalPrompt: handoff.universalPrompt,
          presetKey: handoff.presetKey,
        });
      }
    } catch {
      // Malformed handoff — silently ignored, form starts empty.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Business logic handlers (identical to original) ───────────────────────

  async function handleEnhance() {
    if (!idea.trim()) return;
    setStep("enhancing");
    try {
      const res = await fetch("/api/creative-projects/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: idea.trim(),
          kind,
          presetKey: aspectRatio.presetKey,
          referenceAssetId: reference?.assetId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't enhance your prompt. Please try again.");
        setStep("input");
        return;
      }
      setEnhancedPrompt(json.data.enhancedPrompt);
      setUniversalPrompt(json.data.universalPrompt);
      setStep("preview");
    } catch {
      toast.error("Network error. Please check your connection and try again.");
      setStep("input");
    }
  }

  async function handleGenerate(
    overrides?: { enhancedPrompt?: string; universalPrompt?: unknown; presetKey?: string },
  ) {
    const finalPrompt = overrides?.enhancedPrompt ?? enhancedPrompt;
    if (!finalPrompt.trim()) return;
    const finalUniversalPrompt = overrides?.universalPrompt ?? universalPrompt;
    const finalPresetKey = overrides?.presetKey ?? aspectRatio.presetKey;
    const finalPreset = presets.find((p) => p.key === finalPresetKey);
    const finalTargetWidth = finalPreset?.isCustom ? aspectRatio.customWidth : finalPreset?.targetWidth;
    const finalTargetHeight = finalPreset?.isCustom ? aspectRatio.customHeight : finalPreset?.targetHeight;

    setStep("generating");
    try {
      const res = await fetch("/api/creative-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          presetKey: finalPresetKey,
          title: finalPrompt.trim().slice(0, 60),
          prompt: finalPrompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          contentLanguage: "EN",
          referenceAssetId: reference?.assetId,
          logoAssetId: logo?.assetId,
          targetWidth: finalTargetWidth,
          targetHeight: finalTargetHeight,
          universalPrompt: finalUniversalPrompt,
          promptEnhanced: true,
          rawIdea: idea.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't generate that. Please try again.");
        setStep("preview");
        return;
      }
      setResult(json.data.project);
      setStep("result");
    } catch {
      toast.error("Network error. Please check your connection and try again.");
      setStep("preview");
    }
  }

  async function handleVariation() {
    if (!idea.trim()) return;
    setIsVariationMode(true);
    setStep("enhancing");
    try {
      const res = await fetch("/api/creative-projects/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: idea.trim(),
          kind,
          presetKey: aspectRatio.presetKey,
          referenceAssetId: reference?.assetId,
          variationMode: true,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create a variation. Please try again.");
        setIsVariationMode(false);
        setStep("result");
        return;
      }
      const newEnhancedPrompt: string = json.data.enhancedPrompt;
      const newUniversalPrompt: unknown = json.data.universalPrompt;
      setEnhancedPrompt(newEnhancedPrompt);
      setUniversalPrompt(newUniversalPrompt as UniversalPrompt | undefined);
      setIsVariationMode(false);
      await handleGenerate({ enhancedPrompt: newEnhancedPrompt, universalPrompt: newUniversalPrompt });
    } catch {
      toast.error("Network error. Please check your connection and try again.");
      setIsVariationMode(false);
      setStep("result");
    }
  }

  function backToInput() {
    setStep("input");
  }

  function backToPreview() {
    setStep("preview");
  }

  // ── Derived booleans ──────────────────────────────────────────────────────
  const isBusy = step === "enhancing" || step === "generating";
  const showInputPanel = step === "input" || step === "result";
  const showPreviewPanel = step === "preview" || step === "generating";
  const enhanceEstimated = reference
    ? ENHANCE_WITH_REFERENCE_ESTIMATED_SECONDS
    : ENHANCE_ESTIMATED_SECONDS;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)] bg-[#0B0F19]">

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT PANEL — Prompt workspace + controls
      ══════════════════════════════════════════════════════════════════════ */}
      <aside
        className={`
          lg:sticky lg:top-0 lg:h-[calc(100vh-56px)] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto
          border-b border-white/[0.06] lg:border-b-0 lg:border-r
          bg-[#111827] scrollbar-none
        `}
      >
        {/* Header */}
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h1 className="text-[15px] font-semibold text-white">{copy.title}</h1>
          <p className="mt-0.5 text-[12px] text-white/35">{copy.subtitle}</p>
        </div>

        <div className="flex flex-col gap-5 p-5">

          {/* ── INPUT / RESULT mode: idea textarea + controls ───────────── */}
          <AnimatePresence mode="wait">
            {showInputPanel && (
              <motion.div
                key="input-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5"
              >
                {/* Result mode header */}
                {step === "result" && (
                  <div className="flex items-center justify-between rounded-[14px] border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5">
                    <span className="text-[13px] font-medium text-emerald-400">✓ Generation complete</span>
                  </div>
                )}

                {/* Prompt textarea */}
                <div
                  className="relative rounded-[18px] transition-shadow duration-200"
                  style={{
                    boxShadow: focused
                      ? "0 0 0 2px rgba(124,58,237,0.35), 0 0 28px rgba(124,58,237,0.10)"
                      : "none",
                  }}
                >
                  <textarea
                    ref={textareaRef}
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (idea.trim() && !isBusy) handleEnhance();
                      }
                    }}
                    placeholder={copy.placeholder}
                    rows={4}
                    disabled={isBusy}
                    aria-label="Describe your creation"
                    className="w-full resize-none rounded-[18px] border border-white/[0.09] bg-[#161B26] px-4 py-4 text-[14px] leading-relaxed text-white placeholder-white/25 outline-none scrollbar-none transition-colors duration-200 focus:border-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ minHeight: 120, maxHeight: 320 }}
                  />
                  {/* Enhance shortcut button */}
                  {idea.trim() && !isBusy && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      type="button"
                      onClick={handleEnhance}
                      className="absolute right-3 top-3 flex items-center gap-1.5 rounded-[10px] border border-violet-500/30 bg-violet-500/[0.10] px-2.5 py-1.5 text-[11.5px] font-semibold text-violet-400 transition-all duration-150 hover:border-violet-500/55 hover:bg-violet-500/[0.18] hover:text-violet-300"
                    >
                      <Sparkles className="size-3" />
                      Enhance
                    </motion.button>
                  )}
                  {/* Character counter */}
                  {idea.length > 100 && (
                    <span className="absolute bottom-3 right-4 select-none text-[11px] tabular-nums text-white/20">
                      {idea.length}
                    </span>
                  )}
                </div>

                {/* Asset uploads */}
                <div className="grid grid-cols-2 gap-2.5">
                  <AssetUploadTile
                    label="Reference image"
                    helperText="Style to match"
                    value={reference}
                    onChange={setReference}
                    recentOptions={recentReferences}
                  />
                  <AssetUploadTile
                    label="Brand logo"
                    value={logo}
                    onChange={setLogo}
                    savedOption={savedLogo}
                  />
                </div>

                {/* Format / Aspect ratio */}
                <div>
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                    Format
                  </p>
                  <StudioAspectRatio kind={kind} value={aspectRatio} onChange={setAspectRatio} />
                </div>

                {/* Advanced options */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-white/30 transition-colors duration-150 hover:text-white/60"
                  >
                    {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    Advanced options
                  </button>
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3">
                          <label className="mb-2 block text-[11.5px] text-white/35">
                            Avoid <span className="text-white/20">(optional)</span>
                          </label>
                          <textarea
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="blurry, text errors, watermark, low quality"
                            rows={2}
                            className="w-full resize-none rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-white/70 placeholder-white/20 outline-none transition-colors duration-150 focus:border-white/[0.16] focus:bg-white/[0.05]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Generate CTA */}
                <GradientButton
                  size="lg"
                  disabled={!idea.trim() || isBusy}
                  onClick={handleEnhance}
                  className="w-full"
                >
                  <Wand2 className="size-5" />
                  Enhance & Generate
                </GradientButton>

                {/* In result state: quick re-generate actions */}
                {step === "result" && (
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => handleGenerate()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-white/[0.09] bg-white/[0.03] py-2.5 text-[12.5px] font-medium text-white/55 transition-all duration-150 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white/85"
                    >
                      <RotateCcw className="size-3.5" /> Again
                    </motion.button>
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={handleVariation}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-white/[0.09] bg-white/[0.03] py-2.5 text-[12.5px] font-medium text-white/55 transition-all duration-150 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white/85"
                    >
                      <Shuffle className="size-3.5" /> Variation
                    </motion.button>
                  </div>
                )}

                {/* Keyboard hint */}
                <p className="text-center text-[11px] text-white/18 select-none">
                  ⌘ + Enter to generate
                </p>
              </motion.div>
            )}

            {/* ── PREVIEW / GENERATING mode: enhanced prompt editor ─────── */}
            {showPreviewPanel && (
              <motion.div
                key="preview-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
                {/* Back link */}
                <button
                  type="button"
                  onClick={backToInput}
                  className="flex items-center gap-1.5 text-[12.5px] text-white/35 transition-colors duration-150 hover:text-white/70"
                >
                  <ArrowLeft className="size-3.5" />
                  Edit original idea
                </button>

                {/* Enhanced prompt label */}
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
                  Enhanced Prompt
                </p>

                {/* Editable enhanced prompt */}
                <textarea
                  value={enhancedPrompt}
                  onChange={(e) => setEnhancedPrompt(e.target.value)}
                  rows={9}
                  disabled={step === "generating"}
                  aria-label="Enhanced prompt"
                  className="w-full resize-none rounded-[16px] border border-violet-500/25 bg-violet-500/[0.05] px-4 py-3.5 text-[13px] leading-relaxed text-white/85 outline-none scrollbar-none transition-all duration-200 focus:border-violet-500/45 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.10)] disabled:cursor-not-allowed disabled:opacity-55"
                />

                {/* Generate button (only in preview step) */}
                {step === "preview" && (
                  <>
                    <GradientButton
                      size="lg"
                      disabled={!enhancedPrompt.trim()}
                      onClick={() => handleGenerate()}
                      className="w-full"
                    >
                      <Sparkles className="size-5" />
                      Generate Now
                    </GradientButton>

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={handleVariation}
                      className="w-full rounded-[14px] border border-white/[0.09] bg-white/[0.03] py-3 text-[13px] font-medium text-white/50 transition-all duration-150 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white/80"
                    >
                      Create Variation
                    </motion.button>
                  </>
                )}

                {step === "generating" && (
                  <p className="text-center text-[12.5px] text-white/30 animate-pulse">
                    Generating your image…
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Canvas + Generations grid
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col bg-[#0B0F19]">

        {/* Canvas area */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-12 lg:py-14 min-h-[480px]">
          <AnimatePresence mode="wait">

            {/* Empty state */}
            {step === "input" && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22 }}
                className="w-full flex justify-center"
              >
                <CanvasEmptyState
                  onExampleClick={(p) => {
                    setIdea(p);
                    textareaRef.current?.focus();
                  }}
                />
              </motion.div>
            )}

            {/* Enhancing state */}
            {step === "enhancing" && (
              <motion.div
                key="enhancing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col items-center gap-6 w-full max-w-xs"
              >
                <GenerationProgress
                  estimatedSeconds={
                    isVariationMode ? 8 : enhanceEstimated
                  }
                />
                <p className="text-[13px] text-white/35">
                  {isVariationMode ? "Crafting a creative variation…" : "Analyzing and enhancing your prompt…"}
                </p>
              </motion.div>
            )}

            {/* Preview state — show prompt preview card + AI analysis */}
            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-2xl flex flex-col gap-6"
              >
                {/* Prompt preview card */}
                <div
                  className="rounded-[20px] border p-6"
                  style={{
                    borderColor: "rgba(124,58,237,0.20)",
                    background: "linear-gradient(135deg, rgba(124,58,237,0.05) 0%, rgba(37,99,235,0.03) 100%)",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-violet-500/20">
                      <Sparkles className="size-3.5 text-violet-400" />
                    </span>
                    <span className="text-[12.5px] font-semibold text-violet-400">
                      Prompt enhanced — ready to generate
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/70 line-clamp-6">
                    {enhancedPrompt}
                  </p>
                </div>

                {/* AI analysis accordion */}
                <PromptPreviewPanel
                  universalPrompt={universalPrompt}
                  enhancedPrompt={enhancedPrompt}
                />
              </motion.div>
            )}

            {/* Generating state */}
            {step === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.22 }}
                className="w-full flex justify-center"
              >
                <GenerationProgress estimatedSeconds={estimatedSeconds} />
              </motion.div>
            )}

            {/* Result state */}
            {step === "result" && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0, 0, 0.2, 1] }}
                className="flex w-full flex-col items-center gap-6"
              >
                {result.resultUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05, ease: [0, 0, 0.2, 1] }}
                    className="relative overflow-hidden rounded-[20px] border border-white/[0.09] shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
                    style={{ maxHeight: "68vh" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.resultUrl}
                      alt={result.title}
                      className="max-h-[68vh] w-auto object-contain"
                    />
                    {/* Subtle gradient overlay at bottom */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
                  </motion.div>
                )}

                {/* Toolbar */}
                <CanvasToolbar
                  resultUrl={result.resultUrl!}
                  onVariation={handleVariation}
                  onRegenerate={() => handleGenerate()}
                  onEditPrompt={backToPreview}
                  isBusy={isBusy}
                />

                {/* AI analysis (collapsed) */}
                {universalPrompt && (
                  <div className="w-full max-w-2xl">
                    <PromptPreviewPanel
                      universalPrompt={universalPrompt}
                      enhancedPrompt={enhancedPrompt}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Previous generations grid */}
        <GenerationsGrid kind={kind} />
      </div>
    </div>
  );
}
