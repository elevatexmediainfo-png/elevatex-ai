// Phase 10.6A — Prompt Visual Compiler types.
//
// The compiler sits between PromptSpecification and the Provider Translator
// layer. It never modifies PromptSpecification, prompt-optimizer, or any
// builder — it is a pure, additive, standalone read-only transformation.

/**
 * A - Already Visual: passes through with only mechanical cleanup (enum
 *     expansion, punctuation). No conversion needed — the field already
 *     describes something physically drawable.
 * B - Abstract but convertible: the field's raw text is business/psychology
 *     language, but the CONCEPT it names has a concrete visual equivalent
 *     (via the Visual Translation Engine or a direct enum→English mapping).
 *     Compiled into a physically drawable sentence.
 * C - Business only: no visual equivalent exists or is appropriate. Removed
 *     entirely from the compiled output.
 * D - Duplicate: near-identical content already present elsewhere in this
 *     same compilation. Kept once, removed everywhere else.
 * E - Internal metadata: never describes scene content at all (confidence
 *     scores, validation criteria, governance flags). Never reaches the
 *     compiled output under any circumstance.
 */
export type FieldClassification = "A" | "B" | "C" | "D" | "E";

export interface ClassifiedField {
  /** Dot-path into PromptSpecification, e.g. "marketing.trustStrategy". */
  path: string;
  classification: FieldClassification;
  originalValue: string;
  /** Present only for A/B fields that survive into the compiled output. */
  compiledValue?: string;
  /** For Category B fields converted via the Visual Translation Engine. */
  conceptUsed?: string;
  reason: string;
}

/** One named compiled section — the compiler's replacement for the abstract
 *  section-builders (buildVisibleEmotionSection, buildMarketingSection, etc). */
export interface CompiledSection {
  name: string;
  text: string;
  /** Which of the 15 permitted visual categories this section maps to. */
  visualCategory:
    | "people" | "objects" | "actions" | "relationships" | "environment"
    | "materials" | "camera" | "lighting" | "textures" | "weather"
    | "architecture" | "motion" | "depth" | "interaction" | "micro-details";
}

export interface PromptMetrics {
  wordCount: number;
  sentenceCount: number;
  charCount: number;
  visualTokenRatio: number;
  renderablePct: number;
  abstractPct: number;
  duplicatePct: number;
  promptEfficiency: number;
}

export interface CompilationReport {
  fieldsClassified: Record<FieldClassification, number>;
  fieldsByClassification: Record<FieldClassification, string[]>;
  conceptsTranslated: string[];
  bannedTermsFound: number;
  bannedTermsRemoved: number;
  enumLeaksFound: number;
  enumLeaksFixed: number;
  duplicatesMerged: number;
  before: PromptMetrics;
  after: PromptMetrics;
  targetsMet: {
    visualTokenRatioOver70: boolean;
    duplicateUnder2: boolean;
    abstractUnder20: boolean;
    noEnumLeakage: boolean;
    noBrokenPunctuation: boolean;
    noBannedLanguage: boolean;
  };
}

export interface CompiledPrompt {
  /** The complete abstraction-free text — what a Provider Translator should consume. */
  compiledText: string;
  sections: CompiledSection[];
  fields: ClassifiedField[];
  report: CompilationReport;
}
