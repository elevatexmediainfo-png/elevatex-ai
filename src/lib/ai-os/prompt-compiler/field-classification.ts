import type { PromptSpecification } from "../prompt-spec/types";
import type { VisualPrimitive } from "../visual-translation/types";
import { translateConcept } from "../visual-translation/engine";
import { resolveConcept, resolveIndustry } from "../visual-translation/resolver";
import type { ClassifiedField, FieldClassification } from "./types";
import { naturalizeEnumToken, naturalizeEnumsInText } from "./enum-language";
import { stripBannedLanguage, containsBannedLanguage } from "./banned-language";

// Phase 10.6A — Field Classification.
//
// Every PromptSpecification field is classified once, by path, against the
// rules below. This is the single source of truth for what the compiler
// keeps (A), converts (B), removes (C), or never surfaces (E). Category D
// (duplicate) is resolved separately, across the already-classified output —
// see compile.ts.
//
// The classification rules were derived directly from the Phase 10.5B/10.5D
// audits: PromptSpecification.marketing.* was found to be 0% renderable and
// the single largest source of abstract/duplicate content, so every one of
// its fields defaults to B (convert) or C (remove) — none pass through as A.

type Rule =
  | { kind: "A" } // already visual — pass through with mechanical cleanup only
  | { kind: "B"; concept?: string; scanForConcept?: boolean } // convert: "concept" triggers VTE translation directly;
  // "scanForConcept" additionally allows scanning free text for a concept word — restricted to fields that are
  // short and purely abstract, never to mixed/structural fields (e.g. advertisementLayers) where a single
  // matched word must not discard large amounts of legitimate structural content.
  | { kind: "C" } // business only — remove
  | { kind: "E" }; // internal metadata — never surfaces

function val(field: { value: string } | undefined): string {
  if (!field || field.value === "unknown") return "";
  return field.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct enum -> VTE concept mappings, reused across several fields.
// ─────────────────────────────────────────────────────────────────────────────

const EMOTIONAL_GOAL_TO_CONCEPT: Record<string, string> = {
  trust_and_reassurance: "trust", aspiration_and_desire: "desire", excitement_and_urgency: "urgency",
  transformation_and_hope: "transformation", authority_and_expertise: "authority",
  joy_and_delight: "warmth", curiosity_and_intrigue: "innovation",
};
const EXPERIENCE_TYPE_TO_CONCEPT: Record<string, string> = {
  trust: "trust", aspiration: "desire", luxury: "luxury", belonging: "community",
  education: "expertise", convenience: "reliability", celebration: "achievement",
  discovery: "innovation", healing: "care",
};
const LUXURY_LEVEL_TO_CONCEPT: Record<string, string> = {
  ultra_prestige_perfect: "luxury", luxury_refined: "luxury", premium_polished: "premium",
  professional_quality: "expertise",
};

// ─────────────────────────────────────────────────────────────────────────────
// Field rule table — one entry per PromptSpecification leaf field.
// ─────────────────────────────────────────────────────────────────────────────

function buildRules(spec: PromptSpecification): Record<string, Rule> {
  const experienceType = val(spec.marketing.experienceType);
  const experienceConcept = EXPERIENCE_TYPE_TO_CONCEPT[experienceType];

  return {
    // Mission
    "mission.whatToGenerate": { kind: "B", scanForConcept: true },
    "mission.whyItMatters": { kind: "C" },
    "mission.primarySuccessCriteria": { kind: "E" },
    "mission.nonNegotiableElement": { kind: "B", scanForConcept: true },
    "mission.campaignTheme": { kind: "C" },
    "mission.storyNarrative": { kind: "A" },

    // Hero
    "hero.heroSubject": { kind: "A" },
    "hero.heroImportance": { kind: "B" },
    "hero.heroPosition": { kind: "B" },
    "hero.heroScale": { kind: "B" },
    "hero.heroDetails": { kind: "A" },

    // Supporting
    "supporting.supportingSubjects": { kind: "A" },
    "supporting.relationships": { kind: "A" },
    "supporting.subjectRelationships": { kind: "B" },
    "supporting.relativeScale": { kind: "B" },
    "supporting.requiredObjects": { kind: "A" },
    "supporting.optionalObjects": { kind: "A" },
    "supporting.decorativeElements": { kind: "A" },
    "supporting.trustObjects": { kind: "B" },
    "supporting.educationalObjects": { kind: "A" },
    "supporting.brandObjects": { kind: "B" },
    "supporting.iconElements": { kind: "B" },
    "supporting.infographicElements": { kind: "C" },
    "supporting.featuresSection": { kind: "C" },
    "supporting.statisticsSection": { kind: "C" },
    "supporting.offerSection": { kind: "C" },
    "supporting.advertisementLayers": { kind: "B" }, // mixed content — sentence-level scrub applied

    // Composition
    "composition.primaryComposition": { kind: "B" },
    "composition.secondaryComposition": { kind: "A" },
    "composition.visualBalance": { kind: "B" },
    "composition.symmetry": { kind: "B" },
    "composition.negativeSpace": { kind: "B" },
    "composition.eyeFlow": { kind: "A" },
    "composition.foreground": { kind: "A" },
    "composition.midground": { kind: "A" },
    "composition.background": { kind: "A" },
    "composition.depthTreatment": { kind: "B" },

    // Camera
    "camera.cameraPosition": { kind: "A" },
    "camera.cameraHeight": { kind: "B" },
    "camera.viewingAngle": { kind: "B" },
    "camera.lensIntent": { kind: "B" },
    "camera.distance": { kind: "B" },
    "camera.perspectiveIntent": { kind: "A" },

    // Lighting
    "lighting.primaryLighting": { kind: "A" },
    "lighting.secondaryLighting": { kind: "A" },
    "lighting.moodLighting": { kind: "B" },
    "lighting.shadowStyle": { kind: "B" },
    "lighting.reflectionStyle": { kind: "B" },
    "lighting.cameraMood": { kind: "B" },

    // Environment
    "environment.environmentType": { kind: "B" },
    "environment.storyContext": { kind: "A" },
    "environment.premiumDetails": { kind: "B" },

    // Marketing — the primary offender per 10.5B/10.5D; nothing here passes through as A.
    "marketing.campaignGoal": { kind: "C" },
    "marketing.emotionalGoal": { kind: "B", concept: EMOTIONAL_GOAL_TO_CONCEPT[val(spec.marketing.emotionalGoal)] },
    "marketing.marketingGoal": { kind: "C" },
    "marketing.targetAudience": { kind: "C" },
    "marketing.trustStrategy": { kind: "B", concept: "trust" },
    "marketing.conversionIntent": { kind: "C" },
    "marketing.experienceEmotionalCore": { kind: "B", concept: experienceConcept },
    "marketing.experienceVisualImplication": { kind: "B", concept: experienceConcept },
    "marketing.experienceType": { kind: "B", concept: experienceConcept },
    "marketing.coreMessage": { kind: "C" },
    "marketing.customerPromise": { kind: "C" },
    "marketing.valueProposition": { kind: "C" },
    "marketing.urgencySignal": { kind: "B", concept: "urgency" },
    "marketing.visualTone": { kind: "B", scanForConcept: true },
    "marketing.audiencePainPoints": { kind: "C" },
    "marketing.audienceDesires": { kind: "B", concept: "desire" },
    "marketing.uniqueSellingPoint": { kind: "C" },
    "marketing.attentionStrategy": { kind: "C" },
    "marketing.supportingMessages": { kind: "C" },
    "marketing.emotionalDriver": { kind: "B", scanForConcept: true },

    // Typography — converted to pure negative-space/compositional phrasing, never
    // "CTA"/"logo"/"post-production" framing.
    "typography.reservedHeadlineArea": { kind: "B" },
    "typography.reservedBodyArea": { kind: "B" },
    "typography.reservedCtaArea": { kind: "B" },
    "typography.reservedLogoArea": { kind: "B" },
    "typography.reservedDisclaimerArea": { kind: "B" },
    "typography.platformTextSafetyNote": { kind: "E" },

    // Brand rules
    "brandRules.brandSafety": { kind: "E" },
    "brandRules.industryRestrictions": { kind: "E" },
    "brandRules.mandatoryElements": { kind: "B" },
    "brandRules.forbiddenElements": { kind: "A" },

    // Negative constraints — already concrete exclusion lists (100% renderable per 10.5B).
    "negativeConstraints.forbiddenSceneElements": { kind: "A" },
    "negativeConstraints.forbiddenAiArtifacts": { kind: "A" },
    "negativeConstraints.qualityAntiPatterns": { kind: "A" },
    "negativeConstraints.brandAntiPatterns": { kind: "B" }, // often contains the word "brand" itself

    // Rendering
    "rendering.photorealismLevel": { kind: "B" },
    "rendering.commercialQuality": { kind: "B" },
    "rendering.editorialQuality": { kind: "B" },
    "rendering.luxuryLevel": { kind: "B", concept: LUXURY_LEVEL_TO_CONCEPT[val(spec.rendering.luxuryLevel)] },
    "rendering.realismTarget": { kind: "B" },
    "rendering.artifactPrevention": { kind: "A" },
    "rendering.overallDesignStyle": { kind: "B" },
    "rendering.visualArchetype": { kind: "B" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Production-jargon rewriting: applied to EVERY surviving field, not only
// typography — "CTA", "logo", "post-production", "button" leak into
// supporting.advertisementLayers and similar mixed fields just as often as
// into typography.*. Also strips quoted example-copy lists (e.g. "'Get
// Started', 'Book Today'") — always UI copy, never scene content, and not
// caught by the exact banned-term list because none of those literal words
// are on it.
// ─────────────────────────────────────────────────────────────────────────────

function rewriteTypographyZone(path: string, raw: string): string {
  if (!raw) return "";
  // Strip the leading "X ZONE:" label — keep only the instruction that follows.
  return raw.replace(/^[A-Z\s]+ZONE:\s*/i, "").trim();
}

function stripProductionJargon(text: string): string {
  return text
    .replace(/\([^)]*'[^']+'[^)]*\)/g, "")   // parenthetical quoted-example lists, e.g. (e.g. 'Get Started', 'Book Today')
    .replace(/\bCTA\s*ZONE\b/gi, "the focal area")
    .replace(/\bCTA\b/gi, "the focal point")
    .replace(/\blogo\b/gi, "the identifying mark")
    .replace(/\bpost[- ]?production\b/gi, "afterward")
    .replace(/\bbutton\b/gi, "the marked area")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept conversion — Category B fields with a resolved concept are
// translated through the Visual Translation Engine, exactly like a "trust" or
// "luxury" label becomes a concrete scene detail.
// ─────────────────────────────────────────────────────────────────────────────

function industryHintFrom(spec: PromptSpecification): string | undefined {
  const blob = [val(spec.hero.heroSubject), val(spec.environment.environmentType), val(spec.supporting.requiredObjects)].join(" ");
  const resolution = resolveIndustry(blob);
  return resolution.known ? resolution.key : undefined;
}

function variationSeed(specId: string): number {
  let h = 0;
  for (let i = 0; i < specId.length; i++) h = ((h << 5) - h + specId.charCodeAt(i)) & 0xffffff;
  return Math.abs(h) % 4;
}

function convertViaConcept(
  concept: string,
  industry: string | undefined,
  seed: number,
  usedPrimitiveTexts: Set<string>
): { text: string; primitive?: VisualPrimitive } | null {
  const translation = translateConcept({ concept, industry, variationIndex: seed, maxPrimitives: 4 });
  for (const primitive of translation.primitives) {
    const key = primitive.value.slice(0, 40).toLowerCase();
    if (usedPrimitiveTexts.has(key)) continue;
    usedPrimitiveTexts.add(key);
    return { text: primitive.value, primitive };
  }
  return null;
}

/** Scans free text for any word the VTE resolver already recognises as a concept. */
function firstKnownConceptIn(text: string): string | undefined {
  for (const word of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (word.length < 4) continue;
    const r = resolveConcept(word);
    if (r.known) return r.normalized;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function classifyAllFields(spec: PromptSpecification): ClassifiedField[] {
  const rules = buildRules(spec);
  const industry = industryHintFrom(spec);
  const seed = variationSeed(spec.meta.specId);
  const usedPrimitiveTexts = new Set<string>();
  const fields: ClassifiedField[] = [];

  const fieldGroups: Record<string, Record<string, { value: string } | undefined>> = {
    mission: spec.mission as unknown as Record<string, { value: string } | undefined>,
    hero: spec.hero as unknown as Record<string, { value: string } | undefined>,
    supporting: spec.supporting as unknown as Record<string, { value: string } | undefined>,
    composition: spec.composition as unknown as Record<string, { value: string } | undefined>,
    camera: spec.camera as unknown as Record<string, { value: string } | undefined>,
    lighting: spec.lighting as unknown as Record<string, { value: string } | undefined>,
    environment: spec.environment as unknown as Record<string, { value: string } | undefined>,
    marketing: spec.marketing as unknown as Record<string, { value: string } | undefined>,
    typography: spec.typography as unknown as Record<string, { value: string } | undefined>,
    brandRules: spec.brandRules as unknown as Record<string, { value: string } | undefined>,
    negativeConstraints: spec.negativeConstraints as unknown as Record<string, { value: string } | undefined>,
    rendering: spec.rendering as unknown as Record<string, { value: string } | undefined>,
  };

  for (const [path, rule] of Object.entries(rules)) {
    const [groupName, fieldName] = path.split(".");
    const group = fieldGroups[groupName];
    const rawField = group?.[fieldName];
    const originalValue = val(rawField);

    if (!originalValue) {
      fields.push({ path, classification: "E", originalValue: "", reason: "field is unknown/empty — nothing to compile" });
      continue;
    }

    fields.push(compileOneField(path, rule, originalValue, { industry, seed, usedPrimitiveTexts }));
  }

  return fields;
}

function compileOneField(
  path: string,
  rule: Rule,
  originalValue: string,
  ctx: { industry: string | undefined; seed: number; usedPrimitiveTexts: Set<string> }
): ClassifiedField {
  if (rule.kind === "E") {
    return { path, classification: "E", originalValue, reason: "internal metadata — never describes scene content" };
  }

  if (rule.kind === "C") {
    return { path, classification: "C", originalValue, reason: "business-only language with no visual equivalent — removed" };
  }

  if (rule.kind === "B" && rule.concept) {
    const converted = convertViaConcept(rule.concept, ctx.industry, ctx.seed, ctx.usedPrimitiveTexts);
    if (converted) {
      // Safety net: VTE primitives are designed to be concrete, but are not
      // guaranteed to avoid every word on this compiler's own banned list
      // (e.g. a "premium" primitive ending "...signals editorial premium
      // positioning" legitimately describes a colour palette, but still
      // contains "positioning"). Route through the same clause-level scrub
      // as everything else rather than trusting the source blindly.
      const { cleaned, removedCount } = stripBannedLanguage(converted.text);
      if (cleaned.trim()) {
        return {
          path, classification: "B", originalValue, compiledValue: cleaned, conceptUsed: rule.concept,
          reason: removedCount > 0
            ? `abstract concept "${rule.concept}" converted via VTE; ${removedCount} clause(s) further scrubbed for banned language`
            : `abstract concept "${rule.concept}" converted to a concrete visual instruction via the Visual Translation Engine`,
        };
      }
    }
    // No usable primitive survived — fall through to text cleanup of the original.
  }

  // Category B without a resolvable concept, or A: mechanical cleanup only.
  const zoneStripped = path.startsWith("typography.") ? rewriteTypographyZone(path, originalValue) : originalValue;
  const text = stripProductionJargon(zoneStripped);

  // Only fields explicitly marked scanForConcept may have their ENTIRE value
  // replaced by a single scanned concept match — restricted to short, purely
  // abstract fields. Mixed/structural fields (advertisementLayers, brandObjects,
  // trustObjects, ...) must never have legitimate structural content discarded
  // just because one stray word happens to match a concept name.
  if (rule.kind === "B" && !rule.concept && rule.scanForConcept) {
    const foundConcept = firstKnownConceptIn(text);
    if (foundConcept) {
      const converted = convertViaConcept(foundConcept, ctx.industry, ctx.seed, ctx.usedPrimitiveTexts);
      if (converted) {
        const { cleaned, removedCount } = stripBannedLanguage(converted.text);
        if (cleaned.trim()) {
          return {
            path, classification: "B", originalValue, compiledValue: cleaned, conceptUsed: foundConcept,
            reason: removedCount > 0
              ? `scanned text matched known concept "${foundConcept}"; ${removedCount} clause(s) further scrubbed`
              : `scanned text matched known concept "${foundConcept}", converted via the Visual Translation Engine`,
          };
        }
      }
    }
  }

  const { text: enumFixed } = naturalizeEnumsInText(text);
  const { cleaned, removedCount } = stripBannedLanguage(enumFixed);

  if (!cleaned.trim()) {
    return { path, classification: "C", originalValue, reason: "no visual content survived banned-language removal" };
  }

  return {
    path, classification: rule.kind === "A" ? "A" : "B", originalValue, compiledValue: cleaned,
    reason: removedCount > 0
      ? `${removedCount} clause(s) removed for containing banned business language; remainder kept`
      : rule.kind === "A" ? "already visual — enum tokens naturalised" : "converted via enum/text cleanup (no concept bank match)",
  };
}

export { containsBannedLanguage, naturalizeEnumToken };
