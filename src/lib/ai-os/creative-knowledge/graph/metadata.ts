// Phase 10.4B — Industry Knowledge Graph: semantic metadata types.
//
// Four metadata families that every graph node CAN carry.
// All fields are optional on the node — curators add them progressively.
// Engines read metadata to enable dimension-aware selection.
//
// Dependency direction (strictly enforced):
//   graph/metadata.ts → universal/archetypes/types.ts  (reuse PsychologicalMechanism)
//   graph/metadata.ts → route-engine/types.ts          (reuse Month)
//   graph/ does NOT depend on knowledge data files (industries/, universal/index.ts)
//   graph/ does NOT contain engine logic

import type { PsychologicalMechanism } from "../universal/archetypes/types";
import type { Month } from "../route-engine/types";

// ── 1. SeasonWindow ─────────────────────────────────────────────────────────────

/**
 * Calendar period when this node performs at peak effectiveness.
 * Nodes without SeasonWindow are treated as year-round.
 *
 * Engines apply a boost multiplier when the active month/occasion matches.
 */
export type SeasonName =
  | "spring"     // March–May (northern hemisphere baseline)
  | "summer"     // June–August
  | "autumn"     // September–November
  | "winter"     // December–February
  | "year_round";

/**
 * Cultural and commercial occasions relevant to the Indian market + universal.
 * Engines treat occasion match as a secondary seasonal boost on top of month match.
 */
export type CulturalOccasion =
  | "diwali"
  | "navratri"
  | "dussehra"
  | "holi"
  | "eid"
  | "raksha_bandhan"
  | "ganesh_chaturthi"
  | "onam"
  | "pongal"
  | "christmas"
  | "new_year"
  | "valentine"
  | "mothers_day"
  | "fathers_day"
  | "wedding_season"
  | "back_to_school"
  | "independence_day"
  | "republic_day"
  | "generic";

export interface SeasonWindow {
  /** Dominant calendar season. */
  readonly primary:    SeasonName;
  /**
   * Specific months (1–12) when this node is most effective.
   * Empty array = year-round (all months equally valid).
   */
  readonly months:     Month[];
  /**
   * Cultural occasions that boost this node's relevance.
   * Empty array = no occasion-specific boost.
   */
  readonly occasions:  CulturalOccasion[];
  /**
   * Selection multiplier applied when month/occasion matches.
   * 1.0 = no boost; 1.5 = 50% weight boost; 2.0 = double weight.
   * Capped at 2.0 by the engine.
   */
  readonly boost:      number;
}

/** Default: effective year-round with no occasion boost. */
export const YEAR_ROUND_SEASON: SeasonWindow = {
  primary:   "year_round",
  months:    [],
  occasions: ["generic"],
  boost:     1.0,
};

// ── 2. NodeAudience ─────────────────────────────────────────────────────────────

/**
 * Income and spending-power tiers.
 * Maps to MaterialTier in material-engine.ts conceptually,
 * but is independently defined here so graph/ has no dependency on prompt-spec/.
 */
export type AudienceTier =
  | "budget"        // Value-seeking; price is the primary decision signal
  | "mid_market"    // Quality-conscious; balance of value and aspiration
  | "affluent"      // Quality-over-price; aspiration drives choice
  | "luxury"        // Premium; experience and exclusivity matter most
  | "ultra_luxury"; // Ultra-high-net-worth; bespoke and rare

/**
 * Generalised age groupings for node audience matching.
 * Curators assign the age groups this node most resonates with.
 */
export type AudienceAge =
  | "under_18"
  | "18_24"
  | "25_34"
  | "35_44"
  | "45_54"
  | "55_plus"
  | "all";

export type AudienceGender = "male" | "female" | "non_binary" | "all";

/**
 * Buyer-journey stage where this node is most potent.
 * Aligns with BuyerStage in universal/archetypes/types.ts.
 */
export type BuyerJourneyStage =
  | "awareness"     // First exposure — brand or category discovery
  | "consideration" // Evaluating options; comparing; researching
  | "decision"      // Ready to act; final choice; conversion moment
  | "retention"     // Existing customer; loyalty; re-engagement
  | "advocacy"      // Loyal customer becoming a referrer
  | "all";

/**
 * Audience targeting metadata for a graph node.
 * Enables dimension-aware selection when ExtendedRouteSignals carries audience data.
 */
export interface NodeAudience {
  /** Income/tier groups this node resonates with. */
  readonly tiers:          AudienceTier[];
  /** Age ranges this node primarily addresses. */
  readonly ages:           AudienceAge[];
  /** Gender orientation (most nodes are "all"). */
  readonly gender:         AudienceGender;
  /**
   * Psychographic keywords describing the target audience's values and lifestyle.
   * Examples: "family-first", "status-driven", "health-conscious", "minimalist",
   *           "aspirational", "tradition-values", "achievement-oriented".
   */
  readonly psychographics: string[];
  /** When true, node applies to any audience. Overrides specific tier/age values. */
  readonly universal:      boolean;
}

/** Default: works for any audience. */
export const UNIVERSAL_AUDIENCE: NodeAudience = {
  tiers:          ["budget", "mid_market", "affluent", "luxury", "ultra_luxury"],
  ages:           ["all"],
  gender:         "all",
  psychographics: [],
  universal:      true,
};

// ── 3. NodeLuxury ───────────────────────────────────────────────────────────────

/**
 * Positioning tier of the creative node.
 * Engines use this to match nodes to the brand's material tier.
 *
 * Aligns with MaterialTier from material-engine.ts but independently typed
 * to avoid graph/ depending on prompt-spec/.
 */
export type LuxuryLevel =
  | "mass"          // Volume, broad reach, functional appeal
  | "accessible"    // Mainstream quality; aspirational without exclusivity
  | "premium"       // Clear quality premium; craftsmanship visible
  | "luxury"        // Exclusivity, heritage, status; scarcity valued
  | "ultra_luxury"; // Bespoke, rare, ultra-high specification

/**
 * Luxury positioning metadata for a graph node.
 * Nodes in a luxury scene type should carry a tier ≥ "premium".
 */
export interface NodeLuxury {
  /** The positioning tier this node inhabits. */
  readonly tier:        LuxuryLevel;
  /**
   * Specific luxury signals this node expresses.
   * Examples: "hand-stitched leather", "heritage craftsmanship",
   *           "limited edition", "private consultation", "bespoke finish".
   */
  readonly signals:     string[];
  /**
   * Whether this node requires a luxury execution to work.
   * True = node loses effectiveness if executed below its tier.
   */
  readonly tierLocked:  boolean;
}

export const DEFAULT_LUXURY: NodeLuxury = {
  tier:       "accessible",
  signals:    [],
  tierLocked: false,
};

// ── 4. NodePsychology ───────────────────────────────────────────────────────────

/**
 * Psychological mechanism metadata for a graph node.
 *
 * Uses PsychologicalMechanism from universal/archetypes/types.ts — the same
 * behavioural-science taxonomy applies at both the archetype level and the
 * node level. No duplication.
 */
export type { PsychologicalMechanism } from "../universal/archetypes/types";

/**
 * Funnel stage where this node performs best.
 * "top"  = awareness and discovery
 * "mid"  = consideration and comparison
 * "bot"  = decision and conversion
 * "ret"  = post-purchase retention and advocacy
 * "all"  = effective across all stages
 */
export type FunnelStage = "top" | "mid" | "bot" | "ret" | "all";

/**
 * Psychological intelligence attached to a graph node.
 * Enables psychology-signal-aware node selection in the route engine.
 */
export interface NodePsychology {
  /** Primary psychological mechanism activated by this node. */
  readonly primary:          PsychologicalMechanism;
  /** Optional secondary mechanism (for multi-signal nodes). */
  readonly secondary?:       PsychologicalMechanism;
  /**
   * The specific emotion this node activates in the viewer.
   * Plain language: "trust through expert presence",
   *                 "aspiration through visible transformation", etc.
   */
  readonly emotionalTrigger: string;
  /** Funnel stage where this node is most potent. */
  readonly funnelStage:      FunnelStage;
}

// ── 5. FutureLearningMetadata ───────────────────────────────────────────────────

/**
 * Expanded learning slots for graph nodes.
 * Supersedes FutureMetadata (4 fields) with a richer 8-field structure.
 * All fields null in Phase 10.4B. Populated by future feedback loops.
 *
 * Population schedule:
 *   Phase 10.4F: embeddingVector → Float32Array (semantic similarity search)
 *   Phase 10.5A: successRate, useCount → from generation outcome tracking
 *   Phase 10.5A: lastUsedAt → ISO timestamp from event stream
 *   Phase 10.5B: userAffinity → per-user preference score
 *   Phase 10.5C: conversionLift → A/B outcome data
 *   Phase 10.5D: seasonalIndex → recurring seasonal performance patterns
 *   Phase 10.5E: viralityScore → social engagement signals
 */
export interface FutureLearningMetadata {
  /** Semantic embedding vector for similarity search. Float32Array when active. */
  readonly embeddingVector: null;
  /** Generation success rate 0–1, averaged across all uses. */
  readonly successRate:     null;
  /** ISO 8601 timestamp of last successful use in production. */
  readonly lastUsedAt:      null;
  /** Per-user affinity score 0–1. Requires user context. */
  readonly userAffinity:    null;
  /** Conversion lift percentage vs. generic creative baseline. */
  readonly conversionLift:  null;
  /** Seasonal performance variance — normalised index. */
  readonly seasonalIndex:   null;
  /** Social engagement and share likelihood 0–1. */
  readonly viralityScore:   null;
  /** Cumulative generation count across all users. */
  readonly useCount:        null;
}

export const EMPTY_FUTURE_LEARNING: FutureLearningMetadata = {
  embeddingVector: null,
  successRate:     null,
  lastUsedAt:      null,
  userAffinity:    null,
  conversionLift:  null,
  seasonalIndex:   null,
  viralityScore:   null,
  useCount:        null,
};

// ── Composite NodeMetadata ───────────────────────────────────────────────────────

/**
 * Complete metadata envelope for a graph node.
 * All four metadata families plus expanded future learning.
 * Curators attach this when a node warrants full metadata coverage.
 */
export interface NodeMetadata {
  readonly season:          SeasonWindow;
  readonly audience:        NodeAudience;
  readonly luxury:          NodeLuxury;
  readonly psychology:      NodePsychology;
  readonly futureLearning:  FutureLearningMetadata;
}
