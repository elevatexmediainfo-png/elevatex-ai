// Phase 9.1 — Marketing Review.
// Evaluates: CTA strength, headline presence, benefits quality, conversion signals.
// Input: CommercialCopy + CreativeStrategy. Output: score + issues.

import type { CommercialCopy } from "../copy-intelligence/types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CategoryResult, ReviewIssue } from "./types";
import { clampScore } from "./score-engine";

// Promotional industries where an offer strongly improves conversion
const OFFER_EXPECTED_INDUSTRIES = new Set([
  "retail", "ecommerce", "restaurant", "food_beverage",
  "real_estate", "education", "fitness",
]);

export function reviewMarketing(
  copy:     CommercialCopy,
  strategy: CreativeStrategy,
): CategoryResult {
  const issues: ReviewIssue[] = [];
  let score = 100;

  // ── 1. Headline presence ─────────────────────────────────────────────────────
  if (!copy.headline || copy.headline.trim().length === 0) {
    score -= 25;
    issues.push({
      type: "marketing", severity: "critical",
      message: "Headline is missing — advertisement has no primary message",
      field: "headline",
    });
  } else if (copy.headline.trim().split(/\s+/).length < 2) {
    score -= 8;
    issues.push({
      type: "marketing", severity: "medium",
      message: "Headline is too short to communicate value proposition",
      field: "headline",
    });
  }

  // ── 2. CTA presence ──────────────────────────────────────────────────────────
  if (!copy.cta || copy.cta.trim().length === 0) {
    score -= 25;
    issues.push({
      type: "marketing", severity: "critical",
      message: "Call-to-action is missing — no conversion driver present",
      field: "cta",
    });
  } else {
    const ctaWordCount = copy.cta.trim().split(/\s+/).length;
    if (ctaWordCount > 5) {
      score -= 3;
      issues.push({
        type: "marketing", severity: "low",
        message: "CTA text is too long — effective CTAs are 2–4 words",
        field: "cta",
      });
    }
  }

  // ── 3. Benefits count ────────────────────────────────────────────────────────
  const benefitCount = copy.benefits.length;
  if (benefitCount === 0) {
    score -= 15;
    issues.push({
      type: "marketing", severity: "high",
      message: "No benefits listed — advertisement lacks supporting value points",
      field: "benefits",
    });
  } else if (benefitCount < 3) {
    score -= 5;
    issues.push({
      type: "marketing", severity: "low",
      message: "Fewer than 3 benefits — more supporting points increase persuasion",
      field: "benefits",
    });
  } else if (benefitCount > 6) {
    score -= 3;
    issues.push({
      type: "marketing", severity: "low",
      message: "More than 6 benefits — cognitive overload reduces conversion",
      field: "benefits",
    });
  }

  // ── 4. Social proof ──────────────────────────────────────────────────────────
  if (copy.socialProof.length === 0) {
    score -= 4;
    issues.push({
      type: "marketing", severity: "low",
      message: "No social proof — trust signals improve conversion",
      field: "socialProof",
    });
  }

  // ── 5. Offer for promotional campaigns ───────────────────────────────────────
  const industry = copy.metadata.industry;
  const objective = copy.metadata.objective;
  const isPromotional = objective === "direct_sale" || objective === "lead_generation" || objective === "footfall";

  if (isPromotional && OFFER_EXPECTED_INDUSTRIES.has(industry) && copy.offer === null) {
    score -= 5;
    issues.push({
      type: "marketing", severity: "medium",
      message: "No offer specified for a promotional campaign — discounts or incentives drive conversion",
      field: "offer",
    });
  }

  // ── 6. Footer brand presence ─────────────────────────────────────────────────
  if (!copy.metadata || !copy.metadata.industry) {
    score -= 2;
    issues.push({
      type: "marketing", severity: "low",
      message: "Copy metadata is incomplete — industry not detected",
    });
  }

  // ── 7. Campaign goal alignment ────────────────────────────────────────────────
  const campaignGoal = strategy.marketing.campaignGoal.value;
  if (campaignGoal === "lead_generation" && copy.cta) {
    const ctaLower = copy.cta.toLowerCase();
    const hasConversionVerb =
      ctaLower.includes("book") ||
      ctaLower.includes("call") ||
      ctaLower.includes("contact") ||
      ctaLower.includes("get") ||
      ctaLower.includes("start") ||
      ctaLower.includes("sign") ||
      ctaLower.includes("register") ||
      ctaLower.includes("apply") ||
      ctaLower.includes("join") ||
      ctaLower.includes("claim") ||
      ctaLower.includes("try");
    if (!hasConversionVerb) {
      score -= 4;
      issues.push({
        type: "marketing", severity: "low",
        message: "CTA does not contain a conversion verb for a lead-generation campaign",
        field: "cta",
      });
    }
  }

  // ── 8. Awareness campaigns: headline must be brand-forward ───────────────────
  if (campaignGoal === "awareness" && copy.benefits.length > 5) {
    score -= 2;
    issues.push({
      type: "marketing", severity: "low",
      message: "Awareness campaign has too many benefit points — simplify the message",
      field: "benefits",
    });
  }

  return { score: clampScore(score), issues };
}
