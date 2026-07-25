import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { FieldConfidence } from "../types";
import type { VTEEnrichment } from "./vte-bridge";
import { getHeroSubject } from "./knowledge";

// Phase 10.5A.1 — Hero Fusion Engine.
//
// The 10.5A audit proved the Hero field was structurally unreachable for VTE:
// Creative Brain's hero-decision engine has no code path that returns "unknown",
// so the old winner-take-all chain (Campaign Plan > Creative Brain > VTE > KB)
// always resolved at Creative Brain and never consulted VTE, Experience, or any
// other signal. This module replaces that chain with a merge: every source that
// has something *non-duplicate* to contribute adds one clause to a single final
// sentence. Nothing is ever overwritten — the spine (reference image subject, or
// Creative Brain hero when no reference dominates) is always preserved verbatim.
//
// Pipeline: Reference Image → Creative Brain Hero → Experience Engine → VTE →
//           Campaign Intelligence → Marketing Objective → Commercial Style →
//           Hero Fusion → Final Hero Subject.
//
// This module owns ALL hero-merging logic — no other file composes hero prose.

export interface HeroFusionContributions {
  reference:            boolean;
  creativeBrain:         boolean;
  experience:            boolean;
  vte:                   boolean;
  campaignIntelligence:  boolean;
  marketing:             boolean;
  commercialStyle:       boolean;
}

export interface HeroFusionResult {
  value:         string;
  confidence:    FieldConfidence;
  reasoning:     string;
  contributions: HeroFusionContributions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrative connector glue.
// These are short, closed-enum-keyed phrases that translate a strategy value
// the pipeline already resolved (experience type, campaign category, campaign
// goal, photography style) into a clause fragment. This is grammar glue, not
// an industry/domain knowledge bank — there is no per-industry branching here.
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCE_CLAUSE: Record<string, string> = {
  transformation: "with the change itself doing the convincing",
  aspiration:     "with the quiet pull of something worth wanting",
  trust:          "with the kind of calm that only comes from real competence",
  luxury:         "with unhurried, deliberate care",
  belonging:      "with the warmth of people who feel at home here",
  education:      "with the clarity of something finally understood",
  convenience:    "with visible, effortless ease",
  celebration:    "with a sense of occasion in the air",
  discovery:      "with the charge of something being revealed",
  healing:        "with the relief of tension finally easing",
};

const CAMPAIGN_INTEL_CLAUSE: Record<string, string> = {
  promotion:          "as part of a limited-time promotion",
  awareness:          "as the first real impression of the brand",
  launch:             "on the day everything officially opens",
  offer:              "tied to an offer that will not last",
  educational:        "as part of a moment built to explain, not just sell",
  festival:           "as part of a festive occasion",
  corporate:          "with corporate polish",
  branding:           "as part of the brand's long-running story",
  long_term_campaign: "as part of an ongoing relationship with its audience",
};

const MARKETING_CLAUSE: Record<string, string> = {
  awareness:       "built to be remembered, not just seen",
  lead_generation: "built to turn a glance into an inquiry",
  sales:           "built to close the decision on the spot",
  trust:           "built to earn confidence before a word is spoken",
  education:       "built to make the offering feel understood",
  engagement:      "built to invite a second look",
  retention:       "built to feel like coming back, not arriving new",
};

const STYLE_CLAUSE: Record<string, string> = {
  studio_product: "lit with studio precision",
  lifestyle:      "captured with unposed lifestyle honesty",
  documentary:    "captured with documentary immediacy",
  aerial:         "scaled with an aerial sense of place",
  macro_detail:   "revealed in intimate macro detail",
  editorial:      "framed with editorial restraint",
  before_after:   "framed for a direct, honest comparison",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dedup — significant-word overlap, not substring prefix.
// VTE/enrichment clauses land mid-sentence here (joined by connectors), so a
// "shared leading prefix" check (used for tail-appended KB enrichment elsewhere
// in Phase 10.5A) would miss almost every real duplicate. This checks whether a
// candidate clause's meaningful words already appear in what's been said.
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "with", "this", "that", "from", "into",
  "onto", "their", "its", "his", "her", "who", "while", "being", "never",
  "always", "nearby", "begins", "during", "near", "just", "only", "then",
  "than", "also", "upon", "each", "every", "some", "such", "same", "more",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
}

function overlapsExisting(usedText: string, candidate: string): boolean {
  const used = significantWords(usedText);
  const cand = significantWords(candidate);
  if (cand.size === 0) return true;
  let shared = 0;
  for (const w of cand) if (used.has(w)) shared++;
  return shared >= 2 || shared / cand.size > 0.4;
}

function lowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[.\s]+$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ENRICHMENT_CLAUSES = 4;
const MAX_VTE_CLAUSES = 2;

/**
 * Builds the final hero subject by merging every contributing signal around a
 * fixed spine. The spine is the reference image subject when a reference image
 * dominates (pose/camera/subject must not be altered), otherwise the raw
 * Creative Brain hero decision. Nothing overwrites the spine — sources only
 * add clauses, and only when they say something not already said.
 */
export function buildHero(bp: UniversalCampaignBlueprint, vte?: VTEEnrichment): HeroFusionResult {
  const strategy = bp.strategy;
  const heroDecision = strategy.heroDecision;
  const isReferenceImageDominant = heroDecision?.primarySignals?.includes("reference_image") ?? false;
  const brainHero = strategy.creative.heroSubject.value;

  // Defensive fallback. The 10.5A audit proved this is unreachable today —
  // resolveHeroDecision() always resolves to a concrete subject — but this
  // function must stay total if that upstream guarantee ever changes.
  if (brainHero === "unknown") {
    const industryKey = strategy.business.subIndustry.value !== "unknown"
      ? strategy.business.subIndustry.value
      : strategy.business.industry.value;
    const intentKey = strategy.marketing.campaignGoal.value;

    if (vte?.hasContent) {
      const vtePrimitive = vte.action[0] ?? vte.person[0];
      if (vtePrimitive) {
        return {
          value: vtePrimitive.value,
          confidence: "medium",
          reasoning: `Hero Fusion: Creative Brain produced no hero (defensive path) — VTE ${vtePrimitive.type} primitive used directly`,
          contributions: { reference: false, creativeBrain: false, experience: false, vte: true, campaignIntelligence: false, marketing: false, commercialStyle: false },
        };
      }
    }
    const kbHero = getHeroSubject(industryKey ?? "", intentKey ?? "");
    return {
      value: kbHero,
      confidence: "medium",
      reasoning: `Hero Fusion: Creative Brain produced no hero (defensive path) — knowledge bank fallback for "${industryKey}"`,
      contributions: { reference: false, creativeBrain: false, experience: false, vte: false, campaignIntelligence: false, marketing: false, commercialStyle: false },
    };
  }

  const spine = brainHero;
  let accumulated = spine;
  const acceptedClauses: string[] = [];
  const contributions: HeroFusionContributions = {
    reference: isReferenceImageDominant,
    creativeBrain: true,
    experience: false,
    vte: false,
    campaignIntelligence: false,
    marketing: false,
    commercialStyle: false,
  };

  const tryAccept = (candidate: string | undefined | null): boolean => {
    if (!candidate || !candidate.trim()) return false;
    if (overlapsExisting(accumulated, candidate)) return false;
    acceptedClauses.push(candidate.trim());
    accumulated += " " + candidate;
    return true;
  };

  // 1. Experience Engine — the emotional register of the moment.
  if (acceptedClauses.length < MAX_ENRICHMENT_CLAUSES) {
    const clause = EXPERIENCE_CLAUSE[strategy.experienceProfile?.primary ?? ""];
    if (clause && tryAccept(clause)) contributions.experience = true;
  }

  // 2. Visual Translation Engine — concrete action/person/object primitives.
  // When a reference image must dominate, action/person primitives are excluded
  // because they assert a pose or a subject — exactly what the reference image
  // already fixed. Object/material/spatial primitives describe surroundings, not
  // the subject's pose, so they remain safe to add even then.
  if (vte?.hasContent) {
    const candidates = isReferenceImageDominant
      ? [...vte.object, ...vte.material, ...vte.spatial]
      : [...vte.action, ...vte.person, ...vte.object];
    let vteAccepted = 0;
    for (const primitive of candidates) {
      if (vteAccepted >= MAX_VTE_CLAUSES || acceptedClauses.length >= MAX_ENRICHMENT_CLAUSES) break;
      if (tryAccept(primitive.value)) {
        vteAccepted++;
        contributions.vte = true;
      }
    }
  }

  // 3. Campaign Intelligence — what kind of occasion this is.
  if (acceptedClauses.length < MAX_ENRICHMENT_CLAUSES) {
    const clause = CAMPAIGN_INTEL_CLAUSE[strategy.campaign.campaignCategory.value ?? ""];
    if (clause && tryAccept(clause)) contributions.campaignIntelligence = true;
  }

  // 4. Marketing Objective — what the image is built to do.
  if (acceptedClauses.length < MAX_ENRICHMENT_CLAUSES) {
    const clause = MARKETING_CLAUSE[strategy.marketing.campaignGoal.value ?? ""];
    if (clause && tryAccept(clause)) contributions.marketing = true;
  }

  // 5. Commercial Style — how it's meant to be shot.
  if (acceptedClauses.length < MAX_ENRICHMENT_CLAUSES) {
    const luxury = strategy.visual.luxuryLevel.value;
    const styleBase = STYLE_CLAUSE[strategy.visual.photographyStyle.value ?? ""];
    const clause = styleBase && (luxury === "high" || luxury === "ultra_luxury")
      ? `${styleBase}, luxury-editorial in feel`
      : styleBase;
    if (clause && tryAccept(clause)) contributions.commercialStyle = true;
  }

  const value = (() => {
    if (acceptedClauses.length === 0) return spine;
    // VTE primitives are written as complete standalone sentences (their own
    // trailing period included) — strip that before splicing mid-sentence, or
    // joining with a leading comma produces a stray ".," artifact. Connector
    // glue clauses (Experience/Campaign/Marketing/Style) are prepositional
    // fragments by design ("with...", "as part of...", "built to...") that
    // read naturally after a comma, so every clause joins the same way.
    const base = stripTrailingPunctuation(spine);
    const cleaned = acceptedClauses.map((c) => lowerFirst(stripTrailingPunctuation(c.trim())));
    let sentence = base;
    for (const clause of cleaned) sentence += `, ${clause}`;
    return sentence + ".";
  })();

  const sourcesUsed = (Object.keys(contributions) as (keyof HeroFusionContributions)[])
    .filter((k) => contributions[k]);

  const reasoning = acceptedClauses.length === 0
    ? `Hero Fusion: ${isReferenceImageDominant ? "reference-image" : "Creative Brain"} spine only — no non-duplicate enrichment available from Experience/VTE/Campaign Intelligence/Marketing/Commercial Style`
    : `Hero Fusion: merged [${sourcesUsed.join(", ")}] around the ${isReferenceImageDominant ? "reference-image" : "Creative Brain"} spine — ${acceptedClauses.length} non-duplicate clause(s) added`;

  return {
    value,
    confidence: isReferenceImageDominant ? "high" : strategy.creative.heroSubject.confidence,
    reasoning,
    contributions,
  };
}
