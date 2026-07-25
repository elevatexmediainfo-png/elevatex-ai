import type { AITimelinePlan } from "@/lib/validations/ai-timeline";

// Phase 12 Module 7 — pulled out of ai-auto-edit-panel.tsx (a "use client"
// component with JSX) into its own plain module so it's testable without
// a JSX/React transform: this project's vitest config only picks up
// src/**/*.test.ts with a plain node environment, no React plugin — the
// same "pure logic lives outside JSX files" convention every other
// translator/resolver module in this codebase already follows.

// Sections that carry a per-item accept/reject checkbox in the review
// panel. "music" is a pseudo-section — aiTimelinePlanSchema models it as
// one optional object, not an array — modeled as a single item at index
// 0 so it can share the exact same selection-key scheme as every real
// array section.
export type ReviewSection = "sceneRemoval" | "captions" | "zoom" | "broll" | "stickers" | "music" | "sfx" | "transitions";

export function itemKey(jobId: string, section: ReviewSection, index: number): string {
  return `${jobId}:${section}:${index}`;
}

// Filters a validated plan down to only the items whose checkbox is still
// checked — the ONLY thing that changes between "what the AI proposed"
// and "what actually gets applied." Every downstream section already
// tolerates an empty/reduced array (each translate* function in
// ai-timeline-translator.ts has its own `if (items.length === 0) return
// []` early return); music becomes undefined, same as "GPT proposed no
// music," if its single pseudo-item was unchecked.
export function filterAcceptedPlan(jobId: string, plan: AITimelinePlan, deselected: Set<string>): AITimelinePlan {
  function keep<T>(section: ReviewSection, items: T[]): T[] {
    return items.filter((_, i) => !deselected.has(itemKey(jobId, section, i)));
  }
  return {
    ...plan,
    sceneRemoval: keep("sceneRemoval", plan.sceneRemoval),
    captions: keep("captions", plan.captions),
    zoom: keep("zoom", plan.zoom),
    broll: keep("broll", plan.broll),
    stickers: keep("stickers", plan.stickers),
    sfx: keep("sfx", plan.sfx),
    transitions: keep("transitions", plan.transitions),
    music: plan.music && !deselected.has(itemKey(jobId, "music", 0)) ? plan.music : undefined,
  };
}
