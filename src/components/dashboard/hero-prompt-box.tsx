"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  Building2,
  Image as ImageIcon,
  Mic,
  Sparkles,
  Wand2,
  Video,
  ChevronDown,
  WandSparkles,
} from "lucide-react";

import { CompactAssetUpload, type CompactUploadValue } from "@/components/dashboard/compact-asset-upload";
import { HERO_HANDOFF_KEY } from "@/lib/dashboard/hero-handoff";
import type { ContinueWorkingItem } from "@/lib/dashboard/continue-working";
import { StyleChipSelector, type StyleChip } from "@/components/dashboard/style-chip-selector";
import { PromptEmptyState } from "@/components/dashboard/prompt-empty-state";
import { GradientButton } from "@/components/shared/gradient-button";
import { cn } from "@/lib/utils";

// ─── Static data ────────────────────────────────────────────────────────────

// Style chips — visual state only; wired to generation in a future phase.
const STYLE_CHIPS: StyleChip[] = [
  { id: "cinematic", label: "Cinematic", emoji: "🎬" },
  { id: "realistic", label: "Realistic", emoji: "📷" },
  { id: "thumbnail", label: "Thumbnail", emoji: "🖼️" },
  { id: "product", label: "Product Shoot", emoji: "📦" },
  { id: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { id: "realestate", label: "Real Estate", emoji: "🏠" },
  { id: "instagram", label: "Instagram Post", emoji: "📱" },
  { id: "poster", label: "Poster", emoji: "🎨" },
  { id: "logo", label: "Logo", emoji: "✦" },
  { id: "youtube", label: "YouTube Thumb", emoji: "▶️" },
];

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5", "3:4"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const QUALITY_OPTIONS = [
  { id: "standard", label: "Standard" },
  { id: "hd", label: "HD" },
  { id: "4k", label: "4K" },
] as const;
type Quality = (typeof QUALITY_OPTIONS)[number]["id"];

const SUGGESTED_PROMPTS = [
  "Diwali sale poster for a sweets shop",
  "Modern restaurant Instagram post",
  "Grand opening banner for a gym",
  "Luxury villa real estate ad",
];

// ─── Business logic (UNCHANGED from original) ────────────────────────────────

type Pipeline = "AUTO" | "IMAGE" | "VIDEO" | "TALKING_HEAD" | "MARKETING_CREATIVE";

const PIPELINES: { key: Pipeline; label: string; icon: typeof Wand2 }[] = [
  { key: "AUTO", label: "Auto — AI decides", icon: Sparkles },
  { key: "TALKING_HEAD", label: "AI Video Editor", icon: Mic },
  { key: "VIDEO", label: "AI Video", icon: Video },
  { key: "IMAGE", label: "AI Image", icon: ImageIcon },
  { key: "MARKETING_CREATIVE", label: "Marketing", icon: Building2 },
];

const ROUTE_BY_RESOLVED_KIND: Record<string, string> = {
  AI_IMAGE: "/create/image",
  SOCIAL_MEDIA: "/create/social",
  MARKETING_CREATIVE: "/create/marketing",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface HeroPromptBoxProps {
  displayName: string;
  recentItem: ContinueWorkingItem | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HeroPromptBox({ displayName, recentItem }: HeroPromptBoxProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isLight = mounted && resolvedTheme === "light";

  // Core state (identical to original)
  const [idea, setIdea] = React.useState("");
  const [reference, setReference] = React.useState<CompactUploadValue | null>(null);
  const [logo, setLogo] = React.useState<CompactUploadValue | null>(null);
  const [pipeline, setPipeline] = React.useState<Pipeline>("AUTO");
  const [submitting, setSubmitting] = React.useState(false);

  // New UI state — visual only, no backend changes
  const [focused, setFocused] = React.useState(false);
  const [style, setStyle] = React.useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = React.useState<AspectRatio>("16:9");
  const [quality, setQuality] = React.useState<Quality>("standard");
  const [negativeOpen, setNegativeOpen] = React.useState(false);
  const [negativePrompt, setNegativePrompt] = React.useState("");
  const [enhancing, setEnhancing] = React.useState(false);

  const hasContent = idea.trim().length > 0;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [idea]);

  // ── Prompt enhance (new UI button, uses existing API) ──
  const handleEnhance = React.useCallback(async () => {
    if (!idea.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/creative-projects/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea.trim() }),
      });
      const json = await res.json();
      if (json.success && json.data?.enhancedPrompt) {
        setIdea(json.data.enhancedPrompt);
        toast.success("Prompt enhanced!");
      } else {
        toast.error("Couldn't enhance. Try rephrasing your prompt.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setEnhancing(false);
    }
  }, [idea, enhancing]);

  // ── Generate (IDENTICAL to original logic) ──
  const handleGenerate = React.useCallback(async () => {
    if (submitting) return;

    if (pipeline === "AUTO") {
      if (!idea.trim()) {
        toast.error("Describe what you want to create first.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/creative-projects/enhance-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: idea.trim(),
            referenceAssetId: reference?.assetId,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(
            json.error?.message ??
              "Couldn't understand that idea. Please try rephrasing it.",
          );
          return;
        }
        const { enhancedPrompt, universalPrompt, resolvedKind, resolvedPresetKey } =
          json.data;
        sessionStorage.setItem(
          HERO_HANDOFF_KEY,
          JSON.stringify({
            idea,
            reference,
            logo,
            enhancedPrompt,
            universalPrompt,
            presetKey: resolvedPresetKey,
          }),
        );
        router.push(ROUTE_BY_RESOLVED_KIND[resolvedKind] ?? "/create/image");
      } catch {
        toast.error("Network error. Please check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (pipeline === "IMAGE" || pipeline === "MARKETING_CREATIVE") {
      sessionStorage.setItem(
        HERO_HANDOFF_KEY,
        JSON.stringify({ idea, reference, logo }),
      );
      router.push(
        pipeline === "IMAGE" ? "/create/image" : "/create/marketing",
      );
      return;
    }
    if (pipeline === "VIDEO") {
      router.push(
        idea.trim()
          ? `/create/video/script-ad?idea=${encodeURIComponent(idea.trim())}`
          : "/create/video/script-ad",
      );
      return;
    }
    // B4 (2026-07-22) — this is the only remaining fallthrough case
    // (AUTO/IMAGE/MARKETING_CREATIVE/VIDEO all return above), reached only
    // when pipeline === "TALKING_HEAD". That option's own label above
    // (line 67) already reads "AI Video Editor," not "Talking Head" — but
    // it was still routing to the legacy Talking Head creation flow, a
    // real mislabeling bug. Now matches its own label: the new Cloud Video
    // Editor's upload flow.
    router.push("/create/ai-auto-edit");
  }, [submitting, pipeline, idea, reference, logo, router]);

  // ── Keyboard shortcut: Ctrl/Cmd + Enter to generate ──
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ── Heading ── */}
      <div className="space-y-3">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
          className="text-[2.5rem] md:text-[3rem] lg:text-[3.25rem] font-extrabold text-dash-ink leading-[1.1] tracking-[-0.04em]"
        >
          What do you want to{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #A78BFA 0%, #818CF8 50%, #60A5FA 100%)",
            }}
          >
            create today?
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: [0, 0, 0.2, 1] }}
          className="text-[15px] text-dash-ink/45 font-normal tracking-[-0.01em]"
        >
          Welcome back,{" "}
          <span className="text-dash-ink/65 font-medium">{displayName}</span>
          {" "}— describe what you need, get a finished marketing creative in minutes.
        </motion.p>
      </div>

      {/* ── Prompt card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: [0, 0, 0.2, 1] }}
      >
        <motion.div
          animate={{
            boxShadow: focused
              ? [
                  "0 0 0 1.5px rgba(124,58,237,0.62), 0 0 52px rgba(124,58,237,0.20), 0 0 108px rgba(124,58,237,0.09), 0 8px 32px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.09)",
                  "0 0 0 1.5px rgba(99,102,241,0.68), 0 0 58px rgba(99,102,241,0.22), 0 0 116px rgba(99,102,241,0.10), 0 8px 32px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.09)",
                  "0 0 0 1.5px rgba(37,99,235,0.58), 0 0 52px rgba(37,99,235,0.18), 0 0 108px rgba(37,99,235,0.09), 0 8px 32px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.09)",
                  "0 0 0 1.5px rgba(124,58,237,0.62), 0 0 52px rgba(124,58,237,0.20), 0 0 108px rgba(124,58,237,0.09), 0 8px 32px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.09)",
                ]
              // Idle state: on dark, a hairline white ring reads as elevation;
              // on light, that same ring vanishes — a soft diffused shadow
              // (the "Aurora Light" elevation treatment) does the same job.
              : isLight
                ? "0 0 0 1px rgba(20,20,30,0.08), 0 8px 24px rgba(23,23,35,0.07)"
                : "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.40)",
          }}
          transition={
            focused
              ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.22, ease: [0, 0, 0.2, 1] }
          }
          className="rounded-[20px] overflow-hidden"
          style={{ background: "var(--dash-surface-2)" }}
        >
          {/* Textarea */}
          <div className="px-5 pt-5 pb-3">
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 'Diwali sale poster for my bakery' or 'Instagram reel for my restaurant's grand opening'"
              rows={4}
              aria-label="What do you want to create?"
              className={cn(
                "w-full resize-none bg-transparent outline-none border-none",
                "text-[15.5px] leading-[1.65] text-dash-ink placeholder:text-dash-ink/25",
                "font-normal tracking-[-0.01em]",
                "min-h-[96px] max-h-[280px]",
              )}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-dash-ink/[0.06]">
            {/* Left: Upload + Voice + Enhance */}
            <div className="flex items-center gap-2">
              <CompactAssetUpload
                icon={ImageIcon}
                label="Reference image"
                value={reference}
                onChange={setReference}
              />
              <CompactAssetUpload
                icon={Building2}
                label="Brand logo"
                value={logo}
                onChange={setLogo}
              />

              {/* Voice (coming soon) */}
              <button
                type="button"
                disabled
                title="Voice input — coming soon"
                aria-label="Voice input (coming soon)"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dash-ink/[0.08] bg-dash-ink/[0.03] text-dash-ink/25 cursor-not-allowed"
              >
                <Mic className="size-[15px]" />
              </button>

              {/* Prompt enhance */}
              <motion.button
                type="button"
                disabled={!hasContent || enhancing}
                onClick={handleEnhance}
                whileHover={hasContent && !enhancing ? { scale: 1.05, y: -1 } : {}}
                whileTap={hasContent && !enhancing ? { scale: 0.95 } : {}}
                transition={{ duration: 0.18 }}
                aria-label="Enhance prompt with AI"
                title="Enhance prompt with AI"
                className={cn(
                  "flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-medium transition-colors duration-200",
                  hasContent && !enhancing
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/18 hover:border-violet-500/45"
                    : "border-dash-ink/[0.07] bg-dash-ink/[0.02] text-dash-ink/20 cursor-not-allowed",
                )}
              >
                <WandSparkles className="size-3.5" />
                {enhancing ? "Enhancing…" : "Enhance"}
              </motion.button>
            </div>

            {/* Right: Generate */}
            <GradientButton
              loading={submitting}
              loadingText="Creating…"
              size="default"
              onClick={handleGenerate}
              aria-label="Generate with AI"
            >
              <Sparkles className="size-4" />
              Generate
            </GradientButton>
          </div>
        </motion.div>

        {/* Hint */}
        <p className="mt-2 px-1 text-[11.5px] text-dash-ink/20 text-right">
          {hasContent ? (
            <>Press <kbd className="text-dash-ink/35">⌘ Enter</kbd> to generate</>
          ) : (
            "Tip: be specific for better results"
          )}
        </p>
      </motion.div>

      {/* ── Style chips ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.14, ease: [0, 0, 0.2, 1] }}
        className="space-y-2.5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-dash-ink/25 px-0.5">
          Style
        </p>
        <StyleChipSelector
          chips={STYLE_CHIPS}
          value={style}
          onChange={setStyle}
        />
      </motion.div>

      {/* ── Aspect ratio + Quality ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.17, ease: [0, 0, 0.2, 1] }}
        className="flex flex-wrap gap-6"
      >
        {/* Aspect ratio */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-dash-ink/25 px-0.5">
            Aspect Ratio
          </p>
          <div className="flex gap-1.5" role="group" aria-label="Aspect ratio">
            {ASPECT_RATIOS.map((r) => (
              <SelectorPill
                key={r}
                label={r}
                active={aspectRatio === r}
                onClick={() => setAspectRatio(r)}
              />
            ))}
          </div>
        </div>

        {/* Quality */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-dash-ink/25 px-0.5">
            Quality
          </p>
          <div className="flex gap-1.5" role="group" aria-label="Quality">
            {QUALITY_OPTIONS.map((q) => (
              <SelectorPill
                key={q.id}
                label={q.label}
                active={quality === q.id}
                onClick={() => setQuality(q.id)}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Negative prompt (collapsed) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <button
          type="button"
          onClick={() => setNegativeOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-dash-ink/30 hover:text-dash-ink/55 transition-colors duration-200"
          aria-expanded={negativeOpen}
          aria-controls="negative-prompt-area"
        >
          <motion.span
            animate={{ rotate: negativeOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          >
            <ChevronDown className="size-3.5" />
          </motion.span>
          Negative prompt{negativeOpen ? "" : " (optional)"}
        </button>

        <AnimatePresence initial={false}>
          {negativeOpen && (
            <motion.div
              id="negative-prompt-area"
              key="neg"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Things to avoid… e.g. 'blurry, low quality, dark'"
                rows={2}
                aria-label="Negative prompt"
                className={cn(
                  "w-full resize-none rounded-[18px] px-4 py-3",
                  "bg-dash-surface-2 border border-dash-ink/[0.07]",
                  "text-[13.5px] leading-[1.55] text-dash-ink placeholder:text-dash-ink/20",
                  "outline-none focus:border-dash-ink/[0.14] transition-colors duration-200",
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Pipeline selector (existing functionality, new visual) ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.22, ease: [0, 0, 0.2, 1] }}
        className="space-y-2.5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-dash-ink/25 px-0.5">
          Mode
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Generation mode">
          {PIPELINES.map((p) => {
            const active = pipeline === p.key;
            return (
              <motion.button
                key={p.key}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
                onClick={() => setPipeline(p.key)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium border transition-all duration-200",
                  active
                    ? "border-violet-500/40 bg-violet-500/12 text-violet-700 dark:text-violet-200"
                    : "border-dash-ink/[0.09] bg-dash-ink/[0.03] text-dash-ink/45 hover:text-dash-ink/75 hover:border-dash-ink/[0.16] hover:bg-dash-ink/[0.06]",
                )}
              >
                <p.icon className="size-3.5" />
                {p.label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Suggested prompts ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25, ease: [0, 0, 0.2, 1] }}
        className="space-y-2.5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-dash-ink/25 px-0.5">
          Try these
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <motion.button
              key={prompt}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
              onClick={() => {
                setIdea(prompt);
                textareaRef.current?.focus();
              }}
              className="px-3.5 py-2 rounded-full text-[12.5px] text-dash-ink/45 border border-dash-ink/[0.09] bg-dash-ink/[0.03] hover:text-dash-ink/75 hover:border-dash-ink/[0.16] hover:bg-dash-ink/[0.06] transition-all duration-200"
            >
              {prompt}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Recent item (existing functionality, new visual) ── */}
      {recentItem && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.28 }}
        >
          <Link
            href={recentItem.href}
            className="group inline-flex items-center gap-3 px-4 py-3 rounded-[20px] border border-dash-ink/[0.07] bg-dash-ink/[0.03] hover:bg-dash-ink/[0.06] hover:border-dash-ink/[0.12] transition-all duration-200 w-fit"
          >
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-dash-ink/8">
              {recentItem.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recentItem.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <Wand2 className="size-3.5 text-dash-ink/40" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-ink/25 mb-0.5">
                Continue editing
              </p>
              <p className="text-[13.5px] text-dash-ink/75 font-medium truncate max-w-[280px]">
                {recentItem.title}
              </p>
            </div>
            <ArrowRight className="size-4 text-dash-ink/30 ml-auto flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-dash-ink/55" />
          </Link>
        </motion.div>
      )}

      {/* ── Empty state (shows when no content typed and no recentItem) ── */}
      <AnimatePresence>
        {!hasContent && !recentItem && (
          <PromptEmptyState key="empty" />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared sub-component: compact toggle pill ───────────────────────────────

const SelectorPill = React.memo(function SelectorPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-200",
        active
          ? "border-violet-500/40 bg-violet-500/12 text-violet-700 dark:text-violet-200"
          : "border-dash-ink/[0.09] bg-dash-ink/[0.03] text-dash-ink/40 hover:text-dash-ink/70 hover:border-dash-ink/[0.16] hover:bg-dash-ink/[0.06]",
      )}
    >
      {label}
    </motion.button>
  );
});
