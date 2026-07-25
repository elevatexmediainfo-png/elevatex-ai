import type { PromptSpecification } from "../prompt-spec/types";
import type { ClassifiedField, CompiledPrompt, CompiledSection, FieldClassification } from "./types";
import { classifyAllFields } from "./field-classification";
import { cleanPunctuation } from "./enum-language";
import { measurePrompt, meetsTargets } from "./metrics";

// Phase 10.6A — Prompt Visual Compiler engine.
//
// Pipeline position (this module changes nothing upstream or downstream):
//
//   PromptSpecification -> [Prompt Visual Compiler] -> (future) Provider Translators
//
// This is a pure, additive, read-only transformation. It imports
// PromptSpecification only as a type and calls no builder — every existing
// file in prompt-spec/, prompt-optimizer/, provider-translator/, scene-planner/,
// creative-director/, and creative-brain/ is untouched by this module.

const PATH_TO_CATEGORY: Record<string, CompiledSection["visualCategory"]> = {
  "mission.whatToGenerate": "objects", "mission.nonNegotiableElement": "objects", "mission.storyNarrative": "actions",
  "hero.heroSubject": "people", "hero.heroImportance": "people", "hero.heroPosition": "camera",
  "hero.heroScale": "camera", "hero.heroDetails": "actions",
  "supporting.supportingSubjects": "people", "supporting.relationships": "relationships",
  "supporting.subjectRelationships": "relationships", "supporting.relativeScale": "relationships",
  "supporting.requiredObjects": "objects", "supporting.optionalObjects": "objects",
  "supporting.decorativeElements": "objects", "supporting.trustObjects": "objects",
  "supporting.educationalObjects": "objects", "supporting.brandObjects": "objects",
  "supporting.iconElements": "micro-details", "supporting.advertisementLayers": "objects",
  "composition.primaryComposition": "camera", "composition.secondaryComposition": "camera",
  "composition.visualBalance": "camera", "composition.symmetry": "camera",
  "composition.negativeSpace": "depth", "composition.eyeFlow": "camera",
  "composition.foreground": "depth", "composition.midground": "depth", "composition.background": "depth",
  "composition.depthTreatment": "depth",
  "camera.cameraPosition": "camera", "camera.cameraHeight": "camera", "camera.viewingAngle": "camera",
  "camera.lensIntent": "camera", "camera.distance": "camera", "camera.perspectiveIntent": "camera",
  "lighting.primaryLighting": "lighting", "lighting.secondaryLighting": "lighting",
  "lighting.moodLighting": "lighting", "lighting.shadowStyle": "lighting",
  "lighting.reflectionStyle": "lighting", "lighting.cameraMood": "lighting",
  "environment.environmentType": "environment", "environment.storyContext": "environment",
  "environment.premiumDetails": "materials",
  "marketing.emotionalGoal": "interaction", "marketing.trustStrategy": "interaction",
  "marketing.experienceEmotionalCore": "interaction", "marketing.experienceVisualImplication": "environment",
  "marketing.experienceType": "interaction", "marketing.urgencySignal": "objects",
  "marketing.visualTone": "lighting", "marketing.audienceDesires": "interaction",
  "marketing.emotionalDriver": "interaction",
  "typography.reservedHeadlineArea": "depth", "typography.reservedBodyArea": "depth",
  "typography.reservedCtaArea": "depth", "typography.reservedLogoArea": "depth",
  "typography.reservedDisclaimerArea": "depth",
  "brandRules.mandatoryElements": "objects", "brandRules.forbiddenElements": "objects",
  "negativeConstraints.forbiddenSceneElements": "objects", "negativeConstraints.forbiddenAiArtifacts": "micro-details",
  "negativeConstraints.qualityAntiPatterns": "micro-details", "negativeConstraints.brandAntiPatterns": "objects",
  "rendering.photorealismLevel": "lighting", "rendering.commercialQuality": "lighting",
  "rendering.editorialQuality": "lighting", "rendering.luxuryLevel": "materials",
  "rendering.realismTarget": "lighting", "rendering.artifactPrevention": "micro-details",
  "rendering.overallDesignStyle": "materials", "rendering.visualArchetype": "environment",
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isNearDuplicate(a: string, b: string): boolean {
  const setA = new Set(normalize(a).split(" "));
  const setB = new Set(normalize(b).split(" "));
  if (setA.size <= 3 || setB.size <= 3) return normalize(a) === normalize(b);
  let shared = 0;
  for (const w of setB) if (setA.has(w)) shared++;
  return shared / Math.max(setA.size, setB.size) >= 0.7;
}

/** Resolves Category D: walks surviving A/B fields in order and marks any
 *  field whose compiled text near-duplicates an earlier field's as D. */
function resolveDuplicates(fields: ClassifiedField[]): ClassifiedField[] {
  const kept: string[] = [];
  return fields.map((f) => {
    if ((f.classification !== "A" && f.classification !== "B") || !f.compiledValue) return f;
    const isDup = kept.some((k) => isNearDuplicate(k, f.compiledValue!));
    if (isDup) {
      return { ...f, classification: "D" as FieldClassification, reason: "near-duplicate of an earlier field — merged out" };
    }
    kept.push(f.compiledValue);
    return f;
  });
}

function assembleSections(fields: ClassifiedField[]): CompiledSection[] {
  const byCategory = new Map<CompiledSection["visualCategory"], string[]>();
  for (const f of fields) {
    if ((f.classification !== "A" && f.classification !== "B") || !f.compiledValue) continue;
    const category = PATH_TO_CATEGORY[f.path] ?? "objects";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(f.compiledValue);
  }
  const sections: CompiledSection[] = [];
  for (const [category, texts] of byCategory) {
    sections.push({ name: category, text: cleanPunctuation(texts.join(". ") + "."), visualCategory: category });
  }
  return sections;
}

function buildBeforeText(spec: PromptSpecification): string {
  // Honest "before" baseline: every field's raw, unfiltered, unconverted text —
  // i.e. what reaches the Provider Prompt today, before this compiler exists.
  const groups = [spec.mission, spec.hero, spec.supporting, spec.composition, spec.camera,
    spec.lighting, spec.environment, spec.marketing, spec.typography, spec.brandRules,
    spec.negativeConstraints, spec.rendering];
  const parts: string[] = [];
  for (const g of groups) {
    for (const field of Object.values(g as unknown as Record<string, unknown>)) {
      const f = field as { value?: string } | undefined;
      if (f && typeof f.value === "string" && f.value !== "unknown") parts.push(f.value);
    }
  }
  return parts.join(". ");
}

/** The main entry point. Pure function: PromptSpecification in, CompiledPrompt out. */
export function compileToVisualLanguage(spec: PromptSpecification): CompiledPrompt {
  const classified = classifyAllFields(spec);
  const resolved = resolveDuplicates(classified);
  const sections = assembleSections(resolved);
  const compiledText = cleanPunctuation(sections.map((s) => s.text).join(" "));

  const beforeText = buildBeforeText(spec);
  const before = measurePrompt(beforeText);
  const after = measurePrompt(compiledText);

  const fieldsClassified: Record<FieldClassification, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const fieldsByClassification: Record<FieldClassification, string[]> = { A: [], B: [], C: [], D: [], E: [] };
  for (const f of resolved) {
    fieldsClassified[f.classification]++;
    fieldsByClassification[f.classification].push(f.path);
  }

  const conceptsTranslated = [...new Set(resolved.filter((f) => f.conceptUsed).map((f) => f.conceptUsed!))];
  const bannedTermsFound = classified.filter((f) => f.reason.includes("banned")).length;

  return {
    compiledText,
    sections,
    fields: resolved,
    report: {
      fieldsClassified,
      fieldsByClassification,
      conceptsTranslated,
      bannedTermsFound,
      bannedTermsRemoved: bannedTermsFound,
      enumLeaksFound: 0, // measured pre-fix in regression tests, not tracked per-field here
      enumLeaksFixed: 0,
      duplicatesMerged: fieldsClassified.D,
      before,
      after,
      targetsMet: meetsTargets(after, compiledText),
    },
  };
}
