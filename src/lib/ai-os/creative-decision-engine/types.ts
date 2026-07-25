// Phase 8.5 — Creative Decision Engine types.
// Pure TypeScript interfaces — no business logic.

export type PriorityLevel    = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type RequirementLevel = "YES" | "NO" | "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
export type RuleType         = "MUST" | "NEVER";
export type AudienceSegment  = "luxury" | "premium" | "mass" | "affordable" | "general";

/** Priority weight for one creative dimension within an industry. */
export interface PriorityWeight {
  /** Must match a CampaignKnowledge field name exactly. */
  dimension: string;
  priority:  PriorityLevel;
  /** NON-NEGOTIABLE: GPT must execute this dimension at gold-standard level. */
  mandatory: boolean;
}

/** Single cell of the decision matrix — what level of a feature is required. */
export interface DecisionMatrixItem {
  dimension: string;
  level:     RequirementLevel;
}

/** Per-industry priority map + decision matrix. */
export interface IndustryDecisionProfile {
  industryId: string;
  priorities: PriorityWeight[];
  matrix:     DecisionMatrixItem[];
}

/** One mandatory or forbidden rule for a given industry / campaign type. */
export interface MandatoryRule {
  type: RuleType;
  rule: string;
}

/** Rule set scoped to an industry, optionally narrowed to a campaign type. */
export interface IndustryRuleSet {
  industryId:    string;
  campaignType?: string; // undefined = applies to all campaigns in this industry
  rules:         MandatoryRule[];
}

/** A named visual formula for a specific industry × campaign × audience combination. */
export interface CreativePattern {
  id:                 number;
  name:               string;
  industryId:         string;
  campaignTypes:      string[];  // "*" = any
  audiences:          AudienceSegment[];
  heroWeightPercent:  number;    // percentage of visual frame devoted to hero
  layoutBrief:        string;    // zone distribution brief
  photographyBrief:   string;    // lens + light + angle formula
  typographyBrief:    string;    // typeface register + weight hierarchy
  ctaStyle:           string;    // phrasing and placement guidance
  emotionalTrigger:   string;    // primary psychological conversion mechanism
}

/** Input to the Creative Decision Engine. */
export interface CDEContextInput {
  industry:      string;
  rawIdea:       string;
  campaignGoal?: string;
  campaignType?: string;
  audience?:     string;
}
