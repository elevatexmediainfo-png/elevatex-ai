// Phase 10.4 — Creative Knowledge Platform: shared ID types and enums.
// All Creative Knowledge sub-modules import primitive types from here.
// Nothing else imports from this file's dependents — it has no upstream deps.

// ── Nominal string IDs ──────────────────────────────────────────────────────
// Simple string aliases today; can be branded (string & { _: T }) in a
// future refactor without changing call sites.

export type ArchetypeId         = string;
export type HeroMomentId        = string;
export type CampaignTypeId      = string;
export type SceneTypeId         = string;
export type HumanBehaviourId    = string;
export type RelationshipId      = string;
export type CommercialPatternId = string;

// ── Shared enums ────────────────────────────────────────────────────────────

/**
 * The business-level objective a campaign is trying to achieve.
 * Higher-level than ExperienceType (which describes the emotional mechanism).
 * Used by Archetype Registry and Knowledge Graph to filter compatible entries.
 */
export type CampaignGoal =
  | "awareness"
  | "trust"
  | "education"
  | "engagement"
  | "retention"
  | "conversion"
  | "loyalty"
  | "event_attendance"
  | "announcement"
  | "product_discovery";

/** Confidence in a computed or matched value. */
export type ConfidenceLevel = "high" | "medium" | "low";
