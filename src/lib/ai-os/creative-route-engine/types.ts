// Phase 8.6 — Creative Route Diversity Engine types.
// Pure interfaces — no business logic.

/** What kind of primary subject the route places in the hero position. */
export type HeroType =
  | "human_chef"
  | "human_owner"
  | "human_customer"
  | "human_professional"
  | "human_family"
  | "product_food"
  | "product_item"
  | "product_close_up"
  | "environment_interior"
  | "environment_exterior"
  | "event_moment"
  | "mixed";

/**
 * One distinct commercial execution philosophy for a campaign.
 * All routes for an industry are commercially valid —
 * they differ in creative angle, not in quality.
 */
export interface CreativeRoute {
  id:             string;       // e.g. "food_chef_hero"
  title:          string;       // e.g. "Chef Hero — Craftsmanship & Authority"
  industryId:     string;       // matches IndustryDecisionProfile.industryId

  hero:           string;       // what/who occupies the primary visual zone
  heroType:       HeroType;     // for decision-matrix matching
  composition:    string;       // compositional philosophy
  photography:    string;       // lens + light + angle + shutter approach
  layout:         string;       // zone distribution and reading flow
  marketing:      string;       // the commercial strategy behind this execution
  emotion:        string;       // primary psychological trigger
  productionNote: string;       // one key direction that unlocks this route

  bestFor:        string[];     // campaign keywords that increase this route's score
  notFor:         string[];     // campaign keywords that penalise this route

  baseScore:      number;       // commercial strength when conditions are ideal (60–95)
}

/** A route paired with its computed contextual score. */
export interface ScoredRoute {
  route:  CreativeRoute;
  score:  number;         // 0–100, computed by scorer
  reason: string;         // why this score was assigned
}

/** Final output of the route selection process. */
export interface RouteSelectionResult {
  selected:            ScoredRoute;
  switched:            boolean;          // true if self-review caused a route change
  alternatives:        ScoredRoute[];    // top 3 alternatives
  selectionReason:     string;
  commercialTradeoff:  string;
  productionPhilosophy: string;
}

/** Input to the CRDE. */
export interface CRDEInput {
  industryId:    string;
  campaignType:  string;
  rawIdea:       string;
  campaignGoal?: string;
  audience?:     string;
}
