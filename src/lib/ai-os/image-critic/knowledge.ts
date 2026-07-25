// Phase 16 — Image Critic knowledge bank.
// Scoring weights, quality thresholds, and issue detection patterns.
// Pure data — no logic, no imports.

// ─────────────────────────────────────────────────────────────────────────────
// Quality score weights (must sum to 1.0)
// ─────────────────────────────────────────────────────────────────────────────

export const QUALITY_WEIGHTS = {
  hero:            0.20,   // Hero subject is the most critical creative element
  composition:     0.15,
  lighting:        0.12,
  marketing:       0.18,   // Marketing effectiveness heavily weighted
  brand:           0.12,
  realism:         0.10,
  artifacts:       0.08,   // Artifacts matter but are not always present
  typographySafety:0.05,   // Important only when typography is required
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Default quality thresholds per campaign type
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_QUALITY_THRESHOLD = 65;

export const CAMPAIGN_QUALITY_THRESHOLDS: Record<string, number> = {
  luxury:       80,
  medical:      75,
  finance:      75,
  legal:        75,
  real_estate:  70,
  ecommerce:    68,
  general:      65,
  social_media: 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider-level quality baselines (from Phase 14 knowledge)
// These reflect the typical artistic quality output of each provider.
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_QUALITY_BASELINES: Record<string, number> = {
  openai:           82,
  gemini:           78,
  ideogram:         76,
  flux:             74,
  stable_diffusion: 70,
  veo:              80,
  runway:           78,
  kling:            72,
};

// ─────────────────────────────────────────────────────────────────────────────
// Artifact risk by provider — providers with known artifact tendencies
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_ARTIFACT_RISK: Record<string, "low" | "medium" | "high"> = {
  openai:           "low",
  gemini:           "low",
  ideogram:         "low",
  flux:             "medium",
  stable_diffusion: "high",
  veo:              "low",
  runway:           "medium",
  kling:            "medium",
};

// ─────────────────────────────────────────────────────────────────────────────
// Hero importance to visibility mapping
// ─────────────────────────────────────────────────────────────────────────────

export const HERO_IMPORTANCE_VISIBILITY: Record<string, "clearly_visible" | "likely_visible" | "unclear"> = {
  absolute_mandatory: "clearly_visible",
  the_entire_message: "clearly_visible",
  primary_anchor:     "likely_visible",
  strong_supporting:  "likely_visible",
  contextual_element: "unclear",
};

// ─────────────────────────────────────────────────────────────────────────────
// Human presence keywords — used to determine if human realism applies
// ─────────────────────────────────────────────────────────────────────────────

export const HUMAN_PRESENCE_KEYWORDS = [
  "person", "human", "man", "woman", "people", "doctor", "patient",
  "professional", "model", "face", "smile", "hands", "body",
  "dentist", "nurse", "lawyer", "family", "couple", "team",
] as const;

export const FOOD_PRESENCE_KEYWORDS = [
  "food", "meal", "dish", "restaurant", "cuisine", "plate", "drink",
  "beverage", "coffee", "cake", "fruit", "vegetable", "meat", "bread",
] as const;

export const ARCHITECTURE_PRESENCE_KEYWORDS = [
  "building", "architecture", "interior", "room", "office", "clinic",
  "hospital", "house", "home", "facade", "exterior", "space",
] as const;

export const MEDICAL_PRESENCE_KEYWORDS = [
  "dental", "tooth", "teeth", "implant", "medical", "xray", "scan",
  "anatomy", "surgical", "clinical", "x-ray", "mri", "procedure",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Composition principle quality scores
// ─────────────────────────────────────────────────────────────────────────────

export const COMPOSITION_PRINCIPLE_SCORES: Record<string, number> = {
  rule_of_thirds:         85,
  golden_ratio:           90,
  symmetrical_balance:    80,
  dynamic_diagonal:       78,
  centered_hero:          75,
  leading_lines:          82,
  frame_within_frame:     80,
  negative_space_driven:  85,
  default:                72,
};

// ─────────────────────────────────────────────────────────────────────────────
// Lighting type quality scores
// ─────────────────────────────────────────────────────────────────────────────

export const LIGHTING_TYPE_SCORES: Record<string, number> = {
  studio_soft_box:        88,
  three_point_lighting:   85,
  natural_window_light:   82,
  dramatic_chiaroscuro:   80,
  golden_hour:            85,
  rembrandt:              82,
  high_key:               78,
  low_key:                80,
  ring_light:             76,
  default:                72,
};

// ─────────────────────────────────────────────────────────────────────────────
// Score adjustments for full prompt usage
// ─────────────────────────────────────────────────────────────────────────────

export const FULL_PROMPT_BONUS = 5;
export const TRUNCATED_PROMPT_PENALTY = -10;
export const ALL_FEATURES_SUPPORTED_BONUS = 3;
export const MISSING_FEATURES_PENALTY = -5;
