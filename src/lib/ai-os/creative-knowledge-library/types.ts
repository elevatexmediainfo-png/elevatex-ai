// Phase 8.4 — Creative Knowledge Library types.
//
// Pure TypeScript interfaces — no business logic.
// All business logic lives in context-builder.ts.

/**
 * 5-level teaching example for one creative principle.
 *
 * bad          → what the AI default / stock result looks like
 * whyBad       → why it fails commercially
 * good         → recognisable professional improvement
 * goldStandard → agency-level execution brief
 * why          → conversion psychology that explains why gold standard works
 */
export interface QualityExample {
  bad:          string;
  whyBad:       string;
  good:         string;
  goldStandard: string;
  why:          string;
}

/**
 * Full creative knowledge for one campaign type.
 * Every field follows the 5-level QualityExample teaching format.
 * 12 creative principles × 5 levels = systematic advertising education.
 */
export interface CampaignKnowledge {
  type:    string;    // "luxury_dining", "smile_makeover", etc.
  tags:    string[];  // keyword list for tag-based matching
  goal:    string;    // primary commercial objective
  audience: string;  // who this campaign targets in Indian context

  // 12 creative principles — each with Bad / Why Bad / Good / Gold Standard / Why
  heroSubject:         QualityExample;  // 1. The primary visual subject
  visualHierarchy:     QualityExample;  // 2. How visual weight is distributed
  composition:         QualityExample;  // 3. Frame layout and eye flow
  photography:         QualityExample;  // 4. Lens, height, moment, lighting
  subjectDirection:    QualityExample;  // 5. Human action and body language
  environment:         QualityExample;  // 6. Setting, background, context
  typography:          QualityExample;  // 7. Text hierarchy and commercial register
  layout:              QualityExample;  // 8. Spatial allocation and zones
  commercialDetails:   QualityExample;  // 9. Conversion elements and trust signals
  negativeSpace:       QualityExample;  // 10. White space and breathing room
  marketingPsychology: QualityExample;  // 11. Emotional levers and persuasion
  antiPattern:         QualityExample;  // 12. What to avoid and what to do instead

  conversionInsight: string;  // Single most important commercial insight for this campaign
}

/** All campaigns for one industry vertical. */
export interface IndustryKnowledge {
  id:        string;
  label:     string;
  campaigns: CampaignKnowledge[];
}

/** Global anti-pattern with commercial explanation. */
export interface AntiPattern {
  label:       string;
  description: string;
  why:         string;
  fix:         string;
}

/** Universal design heuristic with application rule. */
export interface DesignHeuristic {
  rule:  string;
  why:   string;
  apply: string;
}

/** Input to the context builder. */
export interface CKLContextInput {
  industry:     string;
  rawIdea:      string;
  campaignGoal?: string;
}
