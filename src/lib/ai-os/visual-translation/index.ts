export type {
  VisualPrimitive,
  VisualPrimitiveType,
  VisualTranslationRequest,
  VisualTranslation,
  MultiConceptTranslation,
  TranslationSource,
  IndustryKey,
  ConceptKey,
  IndustryEntry,
} from "./types";

export { translateConcept, translatePhrase, translateAndMerge } from "./engine";
export { resolveConcept, resolveIndustry } from "./resolver";
export { composePrimitives, deduplicatePrimitives } from "./composer";
export {
  UNIVERSAL_CONCEPTS,
  CONCEPT_ALIASES,
  INDUSTRY_REGISTRY,
  ALL_INDUSTRIES,
  INDUSTRY_ALIASES,
} from "./knowledge/index";
