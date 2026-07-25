// Phase 10.4M — Visual Translation Engine types.
//
// The VTE converts abstract business concepts ("trust", "premium", "authority")
// into concrete, photographable visual instructions that image models can render.
//
// Design contract:
//   ✗ Never returns abstract language — every value must be photographable
//   ✗ Never hardcodes industry logic inside the engine
//   ✓ Knowledge and logic are completely separate modules
//   ✓ Deterministic: same request → same output every run

// ─────────────────────────────────────────────────────────────────────────────
// Visual Primitive — the atomic unit of the engine
// ─────────────────────────────────────────────────────────────────────────────

export type VisualPrimitiveType =
  | "object"       // a physical object visible in the frame
  | "action"       // what a person is doing — the decisive moment
  | "person"       // who is in frame, their posture, expression, and presence
  | "material"     // surface quality, texture, or finish
  | "lighting"     // how the scene is lit and what that communicates
  | "spatial"      // how the physical space is arranged
  | "composition"  // camera angle, framing, and negative space decisions
  | "color";       // dominant color palette signal

export interface VisualPrimitive {
  readonly type: VisualPrimitiveType;
  /** A complete, photographable visual instruction sentence. Never abstract. */
  readonly value: string;
  /** Importance weight 0.0–1.0. Higher = more critical to the concept. */
  readonly weight: number;
  /** Retrieval and deduplication tags. */
  readonly tags: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge structures — pure data, no logic
// ─────────────────────────────────────────────────────────────────────────────

export type ConceptKey = string; // lowercase: "trust", "premium", "authority"

export type IndustryKey =
  | "restaurant"
  | "dental"
  | "salon"
  | "real_estate"
  | "healthcare"
  | "jewellery"
  | "fashion"
  | "fitness"
  | "education"
  | "automobile"
  | "technology"
  | "generic";

/** Universal concept knowledge: concept → primitives applicable to any industry. */
export type UniversalConceptMap = Record<ConceptKey, readonly VisualPrimitive[]>;

/** Industry concept overrides: concept → industry-specific primitives. */
export type IndustryConceptMap = Partial<Record<ConceptKey, readonly VisualPrimitive[]>>;

/** Full industry knowledge entry. */
export interface IndustryEntry {
  readonly key: IndustryKey;
  /** Natural-language aliases that resolve to this industry key. */
  readonly aliases: readonly string[];
  /** Industry-specific visual primitives per concept. */
  readonly concepts: IndustryConceptMap;
}

/** Concept alias map: alternative terms → canonical concept key. */
export type ConceptAliasMap = Record<string, ConceptKey>;

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualTranslationRequest {
  /** The abstract concept to translate. E.g. "trust", "luxury", "trustworthy". */
  readonly concept: string;
  /** Natural-language industry name. E.g. "dental clinic", "Indian restaurant". */
  readonly industry?: string;
  /** Existing hero subject or visual context — used to avoid duplication. */
  readonly context?: {
    readonly heroSubject?: string;
    readonly existingPrimitives?: readonly string[];
  };
  /**
   * Selects a deterministic variation.
   * 0 = highest-weight set (default). 1, 2, 3 = rotated variants.
   * Same index always produces the same set for a given concept + industry.
   */
  readonly variationIndex?: number;
  /** Maximum number of primitives to return. Default 5. */
  readonly maxPrimitives?: number;
}

export type TranslationSource =
  | "industry_specific"  // industry override found and used
  | "universal_only"     // no industry override; fell back to universal
  | "alias_resolved"     // concept was resolved through alias
  | "generic_fallback";  // neither concept nor industry found

export interface VisualTranslation {
  readonly concept: string;
  readonly normalizedConcept: ConceptKey;
  readonly industry: IndustryKey | "unknown";
  readonly primitives: readonly VisualPrimitive[];
  /**
   * A single composed directive in natural language, ready for use as a
   * labeled block in buildImageNativePrompt or buildOpenAIPrompt.
   */
  readonly composedDirective: string;
  /** 0.0–1.0. Lower when using fallback or alias resolution. */
  readonly confidence: number;
  /** True when industry-specific knowledge was unavailable. */
  readonly fallbackUsed: boolean;
  readonly source: TranslationSource;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-concept translation
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiConceptTranslation {
  readonly concepts: readonly string[];
  readonly industry: IndustryKey | "unknown";
  readonly translations: readonly VisualTranslation[];
  /** All primitives merged, deduplicated by tag overlap, sorted by weight. */
  readonly mergedPrimitives: readonly VisualPrimitive[];
  /** Single composed directive covering all input concepts. */
  readonly composedDirective: string;
}
