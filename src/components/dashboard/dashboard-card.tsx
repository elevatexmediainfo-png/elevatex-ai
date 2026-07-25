import { cn } from "@/lib/utils";

// One shared card recipe for every dashboard card (GradientToolCard,
// ContinueEditingRail, TrendingCard, InspirationSection, PopularTemplates,
// StatCard, ComingSoonCard) — previously each repeated its own slightly
// different recipe string. Padding follows an 8px scale (p-4 = 16px,
// p-5 = 20px) instead of the mixed values that had accumulated.
//
// Dark glass — the same recipe the hero (HeroStudioPreview/HeroPromptBox)
// has used since iteration 2 (`bg-white/10 backdrop-blur-xl border-white/10`),
// extended to the rest of the dashboard instead of inventing a second
// language. The resting shadow is a deep ambient drop shadow plus an inset
// top hairline of white — "frosted glass catching light" — instead of a
// flat shadow.
// Aurora Light (2026-07-24) — the deep black-alpha ambient shadow + white
// inset highlight is a dark-surface effect ("frosted glass catching light
// against near-black"); on a light ground the same values read as a heavy
// dark halo, not elevation. Light default is a soft diffused shadow with no
// inset highlight (light cards don't need one to read as glass); dark:
// keeps the exact original values.
// Resting: ambient depth + inner top-edge glass highlight + subtle bottom edge
const REST_SHADOW =
  "shadow-[0_1px_2px_rgba(23,23,35,0.04),0_8px_24px_-8px_rgba(23,23,35,0.10)] " +
  "dark:shadow-[0_2px_6px_rgba(0,0,0,0.35),0_16px_48px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.10),inset_0_-1px_0_0_rgba(0,0,0,0.20)]";
// Hover: dramatically deeper with stronger inner highlight + faint outer glass ring
const HOVER_SHADOW =
  "hover:shadow-[0_4px_12px_-2px_rgba(23,23,35,0.10),0_20px_48px_-16px_rgba(23,23,35,0.16)] " +
  "dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.45),0_28px_72px_-16px_rgba(0,0,0,0.70),inset_0_1px_0_0_rgba(255,255,255,0.18),inset_0_-1px_0_0_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.07)]";

export function dashboardCardClass(opts?: { interactive?: boolean; padding?: "sm" | "md" | "none" }, className?: string) {
  const { interactive = true, padding = "md" } = opts ?? {};
  return cn(
    "rounded-card border border-edge-card bg-glass-card backdrop-blur-xl",
    REST_SHADOW,
    padding === "md" && "p-6",
    padding === "sm" && "p-4",
    interactive && cn(
      "transition-all duration-base ease-out",
      "hover:-translate-y-1 hover:scale-[1.01] hover:border-edge-hover hover:bg-glass-soft",
      HOVER_SHADOW,
    ),
    className
  );
}
