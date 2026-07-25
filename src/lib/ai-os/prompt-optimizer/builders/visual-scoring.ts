import type { PromptSpecification } from "../../prompt-spec/types";
import type { VisualImportanceMap, VisualElement } from "../types";
import { extractEntities, clamp100 } from "./shared";

// Builder 7 — Visual Importance Scoring
// Every named visual element in the spec receives an importance score 0-100.
// This helps Provider Translators know what to emphasise vs. what can be
// loosely interpreted.

export function buildVisualImportanceMap(spec: PromptSpecification): VisualImportanceMap {
  const elements: VisualElement[] = [];
  const seen = new Set<string>();

  function addElement(name: string, importance: number, confidence: number, category: VisualElement["category"], reasoning: string) {
    const key = name.toLowerCase().slice(0, 20);
    if (seen.has(key)) return;
    seen.add(key);
    elements.push({ name, importance: clamp100(importance), confidence: clamp100(confidence), category, reasoning });
  }

  // Hero subject entities — highest importance
  const heroText = spec.hero.heroSubject.value;
  if (heroText !== "unknown") {
    const heroEntities = extractEntities(heroText);
    heroEntities.slice(0, 3).forEach((e, i) =>
      addElement(e, 95 - i * 5, 90, "hero",
        `Named in hero subject description — primary visual element with ${heroText.length > 80 ? "high" : "medium"} specificity`)
    );
  }

  // Supporting subject entities — high but below hero
  const supportingText = spec.supporting.supportingSubjects.value;
  if (supportingText !== "unknown") {
    const supportEntities = extractEntities(supportingText);
    supportEntities.slice(0, 3).forEach((e, i) =>
      addElement(e, 70 - i * 8, 75, "supporting",
        `Named in supporting subjects — secondary visual element`)
    );
  }

  // Required objects — high importance
  const reqObjects = spec.supporting.requiredObjects.value;
  if (reqObjects !== "unknown") {
    reqObjects.split(",").slice(0, 4).forEach((obj, i) => {
      const trimmed = obj.trim();
      if (trimmed.length > 3) {
        addElement(trimmed, 80 - i * 5, 85, "trust",
          `Required object — must be visibly present in the generated image`);
      }
    });
  }

  // Decorative elements — low importance (but present)
  const decorText = spec.supporting.decorativeElements.value;
  if (decorText !== "unknown") {
    const decorEntities = extractEntities(decorText);
    decorEntities.slice(0, 2).forEach(e =>
      addElement(e, 25, 50, "decorative",
        `Decorative element — adds visual richness, can be loosely interpreted`)
    );
  }

  // Environment elements — moderate importance
  const envText = spec.environment.storyContext.value;
  if (envText !== "unknown") {
    const envEntities = extractEntities(envText);
    envEntities.slice(0, 2).forEach(e =>
      addElement(e, 45, 60, "environment",
        `Environmental context element — sets the scene, moderate fidelity required`)
    );
  }

  // Sort by importance descending
  elements.sort((a, b) => b.importance - a.importance);

  const primaryElement = elements[0]?.name ?? spec.hero.heroSubject.value.slice(0, 40) ?? "hero subject";

  // Calculate hierarchy clarity: how well-defined is the visual priority order?
  const hierarchyClarity = elements.length >= 3
    ? clamp100(100 - (elements.filter(e => e.importance > 70).length > 5 ? 15 : 0) - (elements.filter(e => e.importance === 100).length > 2 ? 10 : 0))
    : 70;

  return { elements, primaryElement, hierarchyClarity };
}
