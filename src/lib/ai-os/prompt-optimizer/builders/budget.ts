import type { SectionPriority, BudgetAllocation } from "../types";

// Builder 5 — Prompt Budget Allocation
// Distributes a total character budget across sections proportional to
// their priority weights. High-priority sections receive more budget.

const TOTAL_BUDGET = 4000;
const BUFFER = 300;
const ALLOCATABLE = TOTAL_BUDGET - BUFFER;

export function buildBudgetAllocation(priority: SectionPriority): BudgetAllocation {
  const sections: Array<{ key: keyof Omit<SectionPriority, "priorityReasoning">; weight: number }> = [
    { key: "hero",                weight: priority.hero },
    { key: "negativeConstraints", weight: priority.negativeConstraints },
    { key: "rendering",           weight: priority.rendering },
    { key: "composition",         weight: priority.composition },
    { key: "storytelling",        weight: priority.storytelling },
    { key: "marketing",           weight: priority.marketing },
    { key: "lighting",            weight: priority.lighting },
    { key: "environment",         weight: priority.environment },
    { key: "typography",          weight: priority.typography },
    { key: "camera",              weight: priority.camera },
    { key: "supporting",          weight: priority.supporting },
    { key: "brandRules",          weight: priority.brandRules },
    { key: "mission",             weight: priority.mission },
  ];

  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const alloc: Record<string, number> = {};
  for (const { key, weight } of sections) {
    alloc[key] = Math.round((weight / totalWeight) * ALLOCATABLE);
  }

  return {
    totalBudget:         TOTAL_BUDGET,
    hero:                alloc.hero,
    negativeConstraints: alloc.negativeConstraints,
    rendering:           alloc.rendering,
    composition:         alloc.composition,
    marketing:           alloc.marketing,
    lighting:            alloc.lighting,
    environment:         alloc.environment,
    typography:          alloc.typography,
    camera:              alloc.camera,
    supporting:          alloc.supporting,
    brandRules:          alloc.brandRules,
    mission:             alloc.mission,
    buffer:              BUFFER,
  };
}
