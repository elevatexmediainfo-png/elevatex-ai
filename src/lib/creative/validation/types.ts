// Validation layer (2026-07-28) — deterministic, no AI, no repair. Detects
// and reports; never regenerates or fixes content. Sits alongside the
// pipeline (Creative Brief -> Storyboard -> Scene Bible -> Compiler) as a
// read-only diagnostic pass over already-produced data.

export type ValidationCategory =
  | "creative_brief"
  | "storyboard"
  | "scene_bible"
  | "ownership"
  | "hero_shot"
  | "logo_reveal"
  | "cta"
  | "production_fields"
  | "compiler_contract";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  category: ValidationCategory;
  /** Short, machine-readable code, e.g. "MISSING_FIELD", "SCENE_NOT_FOUND". */
  code: string;
  message: string;
  /** Dotted path to the offending value, e.g. "sceneBible.scenes[2].camera". */
  path: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  /** True iff no issue has severity "error" — warnings alone don't fail validation. */
  valid: boolean;
  issues: ValidationIssue[];
}
