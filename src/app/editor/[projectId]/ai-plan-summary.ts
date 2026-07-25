import type { AITimelinePlan } from "@/lib/validations/ai-timeline";

// Phase 12 Module 10 — a simple confidence/summary count ("X removals, Y
// captions, Z b-roll items proposed") reusing the already-parsed
// aiTimelinePlanSchema result directly, not a new computation. Pure and
// framework-free (kept out of ai-auto-edit-panel.tsx, a .tsx file, per
// this project's established "vitest can't import .tsx" convention — see
// ai-review-selection.ts/ai-reedit-command-map.ts for the same pattern).

export interface AiPlanCounts {
  sceneRemoval: number;
  captions: number;
  zoom: number;
  broll: number;
  brollGenerated: number;
  stickers: number;
  music: number;
  sfx: number;
  transitions: number;
}

export function summarizePlanCounts(plan: AITimelinePlan): AiPlanCounts {
  return {
    sceneRemoval: plan.sceneRemoval.length,
    captions: plan.captions.length,
    zoom: plan.zoom.length,
    broll: plan.broll.length,
    brollGenerated: plan.broll.filter((item) => item.source === "generate").length,
    stickers: plan.stickers.length,
    music: plan.music ? 1 : 0,
    sfx: plan.sfx.length,
    transitions: plan.transitions.length,
  };
}
