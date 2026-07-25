// Phase 10.4.0 — Shared creative-engine pipeline types.
// All engine input/output types build on these shared primitives.
//
// Migration note — types currently duplicated in creative-brain/types.ts:
//   Phase 10.4.0C: creative-brain/types.ts will re-export ExperienceType,
//   HeroType, IndustryCluster from here instead of defining its own.
//   Until then both definitions coexist; they are structurally identical.

import type { SceneIndustry } from "../prompt-spec/scene-builder";
import type { MaterialTier } from "../prompt-spec/material-engine";
import type { CampaignGoal } from "../creative-knowledge/types";

// ── Canonical experience + hero types ─────────────────────────────────────────
// These are defined here going forward. creative-brain/types.ts re-exports in
// Phase 10.4.0C; until then, treat both as identical and interchangeable.

/** The experiential layer — what emotional/sensory journey is being sold. */
export type ExperienceType =
  | "transformation"  // Before/after, dramatic visible change
  | "aspiration"      // Desired future state or status
  | "trust"           // Safety, reliability, expertise
  | "luxury"          // Premium feel, exclusivity, visible craft
  | "belonging"       // Community, family, social connection
  | "education"       // Knowledge, clarity, empowerment
  | "convenience"     // Ease, speed, effortlessness
  | "celebration"     // Joy, occasion, festivity
  | "discovery"       // New, innovative, revealed for the first time
  | "healing";        // Recovery, relief, restoration

/** The visual hero archetype — what kind of subject dominates the frame. */
export type HeroType =
  | "person"          // A human subject — professional, customer, lifestyle
  | "product"         // The product itself is the visual hero
  | "environment"     // The space, location, or setting
  | "transformation"  // Split / before-after visual structure
  | "data"            // Information visualisation, chart, diagram
  | "lifestyle"       // Scene depicting the aspirational life
  | "authority"       // Expert or professional in their domain
  | "moment";         // A specific peak emotional moment

/** Industry cluster — determines which hero types have natural affinity. */
export type IndustryCluster = "authority" | "social_proof" | "environmental" | "balanced";

// ── Pipeline context ──────────────────────────────────────────────────────────

/**
 * The minimal shared signal set for every engine in the pipeline.
 * Each engine's own Input type extends this with engine-specific fields.
 */
export interface PipelineContext {
  /** Resolved industry from Creative Brain Business Intelligence. */
  industry:     SceneIndustry;
  /** Optional sub-industry for finer routing decisions. */
  subIndustry?: string;
  /** Campaign goal from Creative Brain Marketing Intelligence. */
  campaignGoal: CampaignGoal;
  /** Material/luxury tier from material-engine detectMaterialTier(). */
  luxuryTier?:  MaterialTier;
  /** The raw user-provided idea text. Never modified by any engine. */
  rawIdea:      string;
  /** Session ID for memory and diversity correlation across generations. */
  sessionId?:   string;
  /** User ID for memory retrieval and preference scoring. */
  userId?:      string;
}

// ── Knowledge trace ───────────────────────────────────────────────────────────

/**
 * Attached to every engine output — records which knowledge nodes drove each decision.
 *
 * Purpose: enables future feedback loops where generation success/failure
 * flows back to update node weights and commercialScore values.
 * Without this trace, the learning system cannot know which nodes to credit.
 */
export interface KnowledgeTrace {
  /** IDs of all KnowledgeNodes that contributed to this engine's output. */
  readonly nodeIds:    string[];
  /** Aggregate confidence derived from the contributing nodes. */
  readonly confidence: "high" | "medium" | "low";
}
