import type { PromptSpecification } from "../../prompt-spec/types";
import type { SectionPriority, SectionOrder } from "../types";

// Builder 6 — Information Ordering
// Determines the canonical AI OS section order for optimal visual reasoning.
// Starting from the most specific visual anchor (hero) and expanding outward
// to context, then marketing, constraints, and rendering.

export function buildSectionOrder(spec: PromptSpecification, priority: SectionPriority): SectionOrder {
  // AI OS canonical order (provider-agnostic, optimised for visual reasoning)
  const canonical = [
    "hero",               // 1. Most specific: who/what is the subject
    "composition",        // 2. Spatial arrangement — how the hero sits in space
    "camera",             // 3. Viewpoint — from where we see it
    "lighting",           // 4. Illumination — how it's lit
    "environment",        // 5. Context — where it exists
    "supporting",         // 6. Supporting elements that complete the scene
    "marketing",          // 7. Marketing context — what it serves
    "typography",         // 8. Text zones (reservations, not content)
    "negativeConstraints",// 9. What must NOT appear
    "rendering",          // 10. How it should be rendered
    "brandRules",         // 11. Brand compliance
    "mission",            // 12. Executive brief (for reference, lowest in prompt)
  ];

  // Adjustments based on campaign characteristics
  // heroImportance="absolute_mandatory" and heroDetails contains "product" → product shot
  const isProductShot = spec.hero.heroImportance.value === "absolute_mandatory" &&
    (spec.hero.heroDetails.value ?? "").toLowerCase().includes("product");

  // heroDetails or heroSubject mentions transformation → before/after format
  const isBeforeAfter = (spec.hero.heroDetails.value ?? "").toLowerCase().includes("transformation") ||
    (spec.hero.heroSubject.value ?? "").toLowerCase().includes("before") ||
    (spec.hero.heroSubject.value ?? "").toLowerCase().includes("split");

  let ordered = [...canonical];

  // For product shots, move composition up (spatial arrangement is critical)
  if (isProductShot) {
    ordered = ["hero", "lighting", "composition", "camera", "environment", "supporting",
               "marketing", "typography", "negativeConstraints", "rendering", "brandRules", "mission"];
  }

  // For before/after, storytelling logic is implicit in composition
  if (isBeforeAfter) {
    ordered = ["hero", "composition", "environment", "camera", "lighting", "supporting",
               "marketing", "typography", "negativeConstraints", "rendering", "brandRules", "mission"];
  }

  const orderingReasoning = isProductShot
    ? "Product-hero: lighting positioned early (before composition) because product photography quality depends on light quality above all else"
    : isBeforeAfter
    ? "Transformation/before-after: environment and camera elevated because split-frame framing is the most critical compositional decision"
    : "Standard AI OS canonical order: hero → composition → camera → lighting → environment → supporting → marketing → typography → negatives → rendering";

  // Ensure all sections are present (add any missing)
  const allKeys = Object.keys(priority).filter(k => k !== "priorityReasoning");
  for (const k of allKeys) {
    if (!ordered.includes(k)) ordered.push(k);
  }

  return { orderedKeys: ordered, orderingReasoning };
}
