// Phase 10.4A — Universal Archetype Platform types.
// Supersedes creative-knowledge/archetype-registry/types.ts (Phase 10.4).
//
// An Archetype is the highest level of creative intelligence.
// It sits above routes, above industries, above hero subjects.
// One archetype can instantiate across 100 industries × 1000 executions.
//
// Architecture supports 100+ archetypes across 20 categories.
// Registry is in registry.ts; Zod schemas are in schema.ts.

import type { SceneIndustry } from "../../../prompt-spec/scene-builder";
import type { CampaignGoal, ConfidenceLevel } from "../../types";
import type { KnowledgeNode, FutureMetadata } from "../../node";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Archetype Category — 20 strategic archetypes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The strategic domain this archetype belongs to.
 * These are NOT visual categories (arrival, threshold, etc.).
 * These are the COMMERCIAL INTENT categories — WHY this archetype exists.
 *
 * Each archetype belongs to exactly one primary category, and may carry
 * secondary tags for cross-category signal.
 */
export type ArchetypeCategory =
  | "commercial"      // Direct commercial outcome — conversion, purchase, action
  | "emotional"       // Pure emotional resonance — feeling over function
  | "human"           // Human connection, relatable moments, real people
  | "luxury"          // Premium positioning, exclusivity, visible craft
  | "trust"           // Credibility, safety, reliability, expertise
  | "transformation"  // Before/after, visible change, becoming
  | "status"          // Social standing, aspiration, desirability signal
  | "community"       // Group belonging, shared identity, collective
  | "performance"     // Achievement, skill, excellence, mastery
  | "celebration"     // Joy, occasion, milestone, festivity
  | "journey"         // Process, narrative arc, progress over time
  | "education"       // Knowledge transfer, clarity, empowerment
  | "authority"       // Expert positioning, professional leadership
  | "identity"        // Self-expression, personal brand, who I am
  | "belonging"       // Inclusion, shared values, "one of us"
  | "healing"         // Recovery, relief, restoration, renewal
  | "innovation"      // New, different, breakthrough, future-forward
  | "adventure"       // Exploration, discovery, risk, experience
  | "recognition"     // Acknowledgment, reward, validation, being seen
  | "decision";       // Choice clarity, commitment, action-readiness

// ─────────────────────────────────────────────────────────────────────────────
// 2. Commercial Purpose
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The specific commercial mechanism this archetype activates.
 * What it DOES in the market — the outcome it drives.
 */
export type CommercialIntent =
  | "drive_immediate_action"          // Click, call, buy now — short funnel
  | "build_brand_preference"          // Long-term brand positioning and recall
  | "establish_authority"             // Position as the trusted expert choice
  | "create_desire"                   // Make the audience want it viscerally
  | "reduce_purchase_friction"        // Remove doubt, objection, hesitation
  | "generate_social_proof"           // Show others choosing and validating
  | "trigger_emotional_resonance"     // Pure feeling — bypasses rational filter
  | "educate_and_convert"             // Inform first, then close
  | "celebrate_and_retain"            // Delight existing customers
  | "differentiate_from_competition"  // What makes this different — clearly
  | "reframe_price_value"             // Justify premium through perceived value
  | "create_urgency"                  // Time pressure or scarcity signal
  | "inspire_aspiration"              // Show the desired future self
  | "build_community_identity";       // Create "our people" tribal signal

/**
 * Structured commercial purpose attached to every archetype.
 * Answers: what does this archetype DO for the brand commercially?
 */
export interface CommercialPurpose {
  /** The primary commercial mechanism. */
  primaryIntent:       CommercialIntent;
  /** Secondary mechanism when archetype serves dual commercial purposes. */
  secondaryIntent?:    CommercialIntent;
  /** Plain-language description of the conversion mechanism. */
  conversionMechanism: string;
  /** The expected business outcome when this archetype fires correctly. */
  expectedOutcome:     string;
  /** Campaign goals this archetype is optimised for. */
  optimalObjectives:   CampaignGoal[];
  /**
   * Average conversion lift vs. generic creative — null until Phase 10.5
   * populates this from real campaign outcome data.
   */
  readonly averageConversionLift: null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Psychological Purpose
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The psychological mechanism at work — what happens inside the viewer's mind.
 * Grounded in behavioural science, Cialdini, and decision psychology.
 */
export type PsychologicalMechanism =
  | "social_proof"              // Others like me are doing this
  | "authority"                 // Experts and institutions endorse this
  | "scarcity"                  // Limited availability increases perceived value
  | "reciprocity"               // Give value first, earn trust back
  | "liking"                    // Aspirational identification with subject
  | "unity"                     // Shared group identity — we are the same
  | "aspiration"                // Desired future self made visually present
  | "fear_relief"               // Remove a pain, earn loyalty
  | "identity_reinforcement"    // Confirms the viewer's existing self-image
  | "curiosity_gap"             // Create an open loop the viewer must close
  | "loss_aversion"             // Fear of missing what others have
  | "peak_experience"           // Unforgettable emotional peak moment
  | "belonging_signal"          // You are recognised as one of us
  | "transformation_promise"    // You can become this — with our help
  | "recognition_desire"        // Be seen, valued, and acknowledged
  | "autonomy"                  // You are in control — this empowers you
  | "nostalgia"                 // Reconnect with a remembered feeling
  | "status_signalling";        // This choice says something about who you are

/**
 * Structured psychological purpose attached to every archetype.
 * Answers: what happens inside the viewer's mind when this archetype fires?
 */
export interface PsychologicalPurpose {
  /** The primary psychological mechanism. */
  mechanism:          PsychologicalMechanism;
  /** The specific emotion the archetype activates in the viewer. */
  emotionalTrigger:   string;
  /** Optional cognitive bias being leveraged. Plain language. */
  cognitiveBias?:     string;
  /** The deep motivational driver this archetype speaks to. */
  motivationalDriver: string;
  /**
   * Where in the decision journey this archetype performs best.
   * "before" = awareness; "during" = consideration; "after" = retention.
   */
  audienceState:      "before" | "during" | "after" | "all";
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Audience Profile
// ─────────────────────────────────────────────────────────────────────────────

export type IncomeGroup =
  | "budget"          // Value-seeking, price-conscious
  | "mid_market"      // Mainstream, quality-aware
  | "affluent"        // Quality-over-price, aspirational
  | "high_net_worth"  // Luxury, exclusivity, bespoke
  | "all";            // Income-agnostic archetype

export type AgeGroup =
  | "18-24"
  | "25-34"
  | "35-44"
  | "45-54"
  | "55+"
  | "all";

export type BuyerStage =
  | "awareness"     // First exposure — brand or category
  | "consideration" // Evaluating options
  | "decision"      // Ready to buy or act
  | "retention"     // Already a customer, being kept
  | "advocacy";     // Loyal customer being turned into referrer

/**
 * Describes who this archetype resonates with.
 * Drives audience-aware archetype selection in Phase 10.5.
 */
export interface AudienceProfile {
  /** Income groups this archetype resonates with. */
  incomeGroups:   IncomeGroup[];
  /** Age demographics this archetype primarily targets. */
  ageGroups:      AgeGroup[];
  /** Buyer journey stages where this archetype performs best. */
  buyerStages:    BuyerStage[];
  /**
   * Psychographic keywords — lifestyle, values, personality traits.
   * Examples: "health-conscious", "family-first", "status-driven", "minimalist"
   */
  psychographics: string[];
  /** True if archetype works regardless of income, age, or stage. */
  universal:      boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Future Score (archetype-specific performance learning)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performance learning slots specific to archetypes.
 * Distinct from KnowledgeNode.futureMetadata (which holds generic ML slots).
 * All null until Phase 10.5 activates real campaign feedback loops.
 *
 * Phase 10.5A: performanceScore + conversionLift from campaign outcome data
 * Phase 10.5B: viralityIndex from social engagement signals
 * Phase 10.5C: brandAffinityScore from brand-safety + audience fit metrics
 * Phase 10.5D: seasonalIndex from recurring performance patterns
 */
export interface ArchetypeFutureScore {
  /** Overall archetype performance vs. baseline — 0–100 when active. */
  readonly performanceScore:   null;
  /** Social engagement and share likelihood — 0–1 when active. */
  readonly viralityIndex:      null;
  /** Conversion lift vs. generic creative in A/B tests — percentage when active. */
  readonly conversionLift:     null;
  /** Brand safety and audience fit composite — 0–100 when active. */
  readonly brandAffinityScore: null;
  /** Seasonal performance variance — normalised index when active. */
  readonly seasonalIndex:      null;
}

export const EMPTY_ARCHETYPE_FUTURE_SCORE: ArchetypeFutureScore = {
  performanceScore:   null,
  viralityIndex:      null,
  conversionLift:     null,
  brandAffinityScore: null,
  seasonalIndex:      null,
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. UniversalArchetype — the main interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Universal Archetype — the highest unit of creative intelligence.
 *
 * Sits above: industry routes, hero subjects, layouts, camera positions.
 * Sits below: nothing — this is the top of the creative knowledge hierarchy.
 *
 * One archetype can instantiate across every industry, every campaign type,
 * every execution format. The archetype defines the STORY SHAPE; everything
 * below it defines the EXECUTION of that shape.
 *
 * Extends KnowledgeNode so it works with the KnowledgeStore query system.
 * The base KnowledgeNode fields that apply:
 *   id             — stable screaming-kebab: "trust:patient-discovery"
 *   kind           — always "archetype"
 *   tags           — searchable keywords for flexible querying
 *   priority       — 1 (highest) to 10 (lowest) — default selection order
 *   weight         — 0.0–1.0 — influence weight in blended scoring
 *   confidence     — curator confidence in this entry's creative validity
 *   commercialScore — 0–100 — curator-set expected commercial effectiveness
 *   futureMetadata  — generic ML slots (embedding, recency, user affinity)
 */
export interface UniversalArchetype extends KnowledgeNode {
  readonly kind: "archetype";

  // ── Identity ───────────────────────────────────────────────────────────────

  /** Display name. Concise, memorable. Examples: "The Patient Discovery",
   *  "The Table They Remember", "The Craftsman's Final Touch". */
  readonly name:         string;
  /** One sentence — what this archetype IS, not how to execute it.
   *  Never describe execution, lighting, or composition here. */
  readonly description:  string;
  /** Primary strategic category. */
  readonly category:     ArchetypeCategory;
  /** Optional refinement within a category — enables 100+ archetypes per category. */
  readonly subcategory?: string;

  // ── Commercial intelligence ────────────────────────────────────────────────

  /** What this archetype does for the brand commercially. */
  readonly commercialPurpose: CommercialPurpose;

  // ── Psychological intelligence ─────────────────────────────────────────────

  /** What this archetype does inside the viewer's mind. */
  readonly psychologicalPurpose: PsychologicalPurpose;

  // ── Compatibility ──────────────────────────────────────────────────────────

  /** Industries this archetype natively fits. "all" = no industry restriction. */
  readonly compatibleIndustries: SceneIndustry[] | "all";
  /** Campaign goals this archetype is optimised for. */
  readonly compatibleCampaigns:  CampaignGoal[];
  /** Audience profile this archetype resonates with. */
  readonly compatibleAudience:   AudienceProfile;

  // ── Future performance learning ────────────────────────────────────────────

  /** Archetype-specific performance slots. All null until Phase 10.5. */
  readonly futureScore: ArchetypeFutureScore;

  // ── Phase bridges ──────────────────────────────────────────────────────────

  /** Bridge to Phase 10.4 archetype-registry id — set when migrated from old registry. */
  readonly legacyArchetypeId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Registry filter — used by registry.ts query functions
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchetypeFilter {
  category?:    ArchetypeCategory | ArchetypeCategory[];
  industry?:    SceneIndustry;
  campaign?:    CampaignGoal;
  buyerStage?:  BuyerStage;
  incomeGroup?: IncomeGroup;
  mechanism?:   PsychologicalMechanism;
  intent?:      CommercialIntent;
  /** Full-text search across name + description + tags. Case-insensitive. */
  search?:      string;
  /** Maximum results to return. Applied after sort. */
  limit?:       number;
  sortBy?:      "priority" | "weight" | "commercialScore";
}
