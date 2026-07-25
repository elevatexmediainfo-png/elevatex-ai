import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualPrimitive } from "../visual-translation/types";
import { translateAndMerge } from "../visual-translation/engine";

// Phase 10.5A — VTE Bridge
// Converts a UniversalCampaignBlueprint into a VTEEnrichment struct.
// Called once per scene plan; result is passed to each builder that needs it.
//
// Priority contract (matches the full pipeline):
//   1. Reference image (handled upstream in hero-decision-engine — not touched here)
//   2. Creative Brain / Campaign Plan (builders check these first; VTE enriches or replaces)
//   3. VTE (this module) — replaces knowledge-bank fallbacks; enriches creative-brain output
//   4. Knowledge bank fallback (scene-planner/knowledge.ts — used when VTE has no content)

export interface VTEEnrichment {
  /** Decisive-moment action primitives — highest value for hero moment enrichment */
  action: readonly VisualPrimitive[];
  /** Person/subject description primitives — for hero and supporting subject enrichment */
  person: readonly VisualPrimitive[];
  /** Physical object primitives — for required/optional objects and trust signals */
  object: readonly VisualPrimitive[];
  /** Surface / texture / material primitives — for environment detail */
  material: readonly VisualPrimitive[];
  /** Lighting direction primitives — for lighting builder enrichment */
  lighting: readonly VisualPrimitive[];
  /** Spatial / environmental arrangement primitives — for environment builder */
  spatial: readonly VisualPrimitive[];
  /** Composition / framing primitives — for composition builder */
  composition: readonly VisualPrimitive[];
  /** Single composed prose directive covering all translated concepts */
  composedDirective: string;
  /** IndustryKey resolved by the VTE for the campaign */
  resolvedIndustry: string;
  /** False when VTE returned no primitives (unknown industry + unknown concepts) */
  hasContent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept extraction maps
// ─────────────────────────────────────────────────────────────────────────────

const ARCHETYPE_CONCEPTS: Readonly<Record<string, readonly string[]>> = {
  trust_reveal:          ["trust", "care"],
  expert_in_action:      ["expertise", "authority"],
  transformation_story:  ["transformation", "confidence"],
  before_after:          ["transformation"],
  lifestyle_aspiration:  ["premium", "desire"],
  social_proof:          ["trust", "community"],
  educational_explainer: ["expertise", "innovation"],
  authority_showcase:    ["authority", "expertise"],
  celebration_moment:    ["celebration", "warmth"],
  product_showcase:      ["craftsmanship", "quality"],
  local_champion:        ["trust", "community"],
  launch_announcement:   ["innovation", "achievement"],
  offer_promotion:       ["desire"],
  seasonal_campaign:     ["warmth", "celebration"],
  trust_authority:       ["authority", "trust"],
  product_hero:          ["craftsmanship", "quality"],
  service_hero:          ["expertise", "care"],
  brand_story:           ["premium", "warmth"],
};

const EMOTIONAL_CONCEPT: Readonly<Record<string, string>> = {
  trust_and_reassurance:   "trust",
  aspiration_and_desire:   "desire",
  transformation_and_hope: "transformation",
  excitement_and_urgency:  "achievement",
  authority_and_expertise: "authority",
  warmth_and_belonging:    "warmth",
  pride_and_achievement:   "achievement",
};

const GOAL_CONCEPT: Readonly<Record<string, string>> = {
  lead_generation: "trust",
  brand_awareness: "premium",
  sales:           "desire",
  education:       "expertise",
  trust:           "trust",
  event_promotion: "celebration",
};

// ─────────────────────────────────────────────────────────────────────────────
// Concept extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractConcepts(bp: UniversalCampaignBlueprint): string[] {
  const archetype = bp.campaign.concept.campaignArchetype.value ?? "";
  const emotional = (bp.campaign.concept.emotionalHook.value as string) ?? "";
  const goal      = bp.strategy.marketing.campaignGoal.value ?? "";
  const luxury    = bp.strategy.visual.luxuryLevel.value ?? "";

  const concepts = new Set<string>();

  // 1. Archetype — highest specificity, contributes 1–2 concepts
  for (const c of (ARCHETYPE_CONCEPTS[archetype] ?? [])) concepts.add(c);

  // 2. Emotional hook — adds a complementary concept
  const ec = EMOTIONAL_CONCEPT[emotional];
  if (ec) concepts.add(ec);

  // 3. Campaign goal — fills remaining slots
  const gc = GOAL_CONCEPT[goal];
  if (gc && concepts.size < 3) concepts.add(gc);

  // 4. Luxury level adds "premium" when space remains
  if ((luxury === "ultra_luxury" || luxury === "high") && concepts.size < 3) {
    concepts.add("premium");
  }

  // 5. Always have at least one concept so VTE can produce output
  if (concepts.size === 0) concepts.add("trust");

  return [...concepts].slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic variation seed
// ─────────────────────────────────────────────────────────────────────────────

function variationSeed(bp: UniversalCampaignBlueprint): number {
  const id = bp.meta.blueprintId ?? "";
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) & 0xffffff;
  }
  return Math.abs(h) % 4; // deterministic 0–3
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Builds VTE enrichment for the given blueprint. Pure function — no I/O, no LLM. */
export function buildVTEEnrichment(bp: UniversalCampaignBlueprint): VTEEnrichment {
  const industry = bp.strategy.business.subIndustry.value !== "unknown"
    ? bp.strategy.business.subIndustry.value
    : bp.strategy.business.industry.value;

  const concepts = extractConcepts(bp);
  const varIdx   = variationSeed(bp);

  const merged = translateAndMerge(concepts, industry, varIdx, 3);

  if (merged.mergedPrimitives.length === 0) {
    return {
      action: [], person: [], object: [], material: [],
      lighting: [], spatial: [], composition: [],
      composedDirective:  "",
      resolvedIndustry:   String(merged.industry),
      hasContent:         false,
    };
  }

  const ps = merged.mergedPrimitives;
  return {
    action:      ps.filter(p => p.type === "action"),
    person:      ps.filter(p => p.type === "person"),
    object:      ps.filter(p => p.type === "object"),
    material:    ps.filter(p => p.type === "material"),
    lighting:    ps.filter(p => p.type === "lighting"),
    spatial:     ps.filter(p => p.type === "spatial"),
    composition: ps.filter(p => p.type === "composition"),
    composedDirective:  merged.composedDirective,
    resolvedIndustry:   String(merged.industry),
    hasContent:         true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication helper used by all builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the candidate primitive is likely a semantic duplicate of
 * the existing string — prevents the same visual instruction appearing twice.
 * Uses a simple leading-token check: if the first 28 characters of the
 * candidate already appear in the existing string, it's a duplicate.
 */
export function vteWouldDuplicate(existing: string, candidate: string): boolean {
  if (!existing || !candidate) return false;
  const ex   = existing.toLowerCase();
  const lead = candidate.toLowerCase().slice(0, 28);
  return ex.includes(lead);
}
