// Phase 8.5 — Creative Decision Engine — Public API.
//
// buildCreativeContext() replaces buildCKLContext() as the primary context
// injection function in gpt-engine.ts. It combines:
//   1. CKL — 3–5 selected goldStandard examples (not all 12)
//   2. CDE — priority weights, decision matrix, mandatory rules,
//             best-fit pattern, self-review mandate, commercial score targets
//
// Total context: ~800–1000 tokens (vs ~700 for old CKL dump), with far
// higher instruction quality and a built-in GPT self-correction loop.

import { getCampaignResolution }   from "../creative-knowledge-library/context-builder";
import { getDecisionProfile }      from "./decision-matrices";
import { getRulesForIndustry }     from "./rule-engine";
import { findBestPattern }         from "./pattern-registry";
import { selectRelevantExamples }  from "./example-selector";
import { buildSelfReviewInstruction, buildCommercialScoreInstruction } from "./self-review-engine";
import type { CDEContextInput, PriorityWeight } from "./types";

export type { CDEContextInput };

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function priorityBar(p: number): string {
  return "█".repeat(p) + "░".repeat(10 - p);
}

function formatDimension(dim: string): string {
  return dim
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim()
    .padEnd(20);
}

function buildPrioritySection(priorities: PriorityWeight[]): string {
  const sorted = [...priorities].sort((a, b) => b.priority - a.priority);
  const lines  = sorted.map(p =>
    `  ${formatDimension(p.dimension)}${priorityBar(p.priority)}  ${p.priority}/10${p.mandatory ? "  NON-NEGOTIABLE" : ""}`
  );
  return `DIMENSION PRIORITIES:\n${lines.join("\n")}`;
}

function buildMatrixSection(matrix: { dimension: string; level: string }[]): string {
  const lines = matrix.map(m => `  ${m.dimension.padEnd(28)}${m.level}`);
  return `DECISION MATRIX:\n${lines.join("\n")}`;
}

function buildRulesSection(rules: { type: string; rule: string }[]): string {
  const lines = rules.map(r =>
    `  ${r.type === "MUST" ? "✓ MUST:  " : "✗ NEVER: "}${r.rule}`
  );
  return `MANDATORY RULES:\n${lines.join("\n")}`;
}

function buildPatternSection(pattern: {
  id: number; name: string; heroWeightPercent: number;
  layoutBrief: string; photographyBrief: string;
  typographyBrief: string; ctaStyle: string; emotionalTrigger: string;
}): string {
  return [
    `SELECTED PATTERN #${pattern.id}: ${pattern.name}`,
    `  Hero weight:    ${pattern.heroWeightPercent}% of visual frame`,
    `  Layout:         ${pattern.layoutBrief}`,
    `  Photography:    ${pattern.photographyBrief}`,
    `  Typography:     ${pattern.typographyBrief}`,
    `  CTA style:      ${pattern.ctaStyle}`,
    `  Emotional core: ${pattern.emotionalTrigger}`,
  ].join("\n");
}

function dimensionLabel(dim: string): string {
  const labels: Record<string, string> = {
    heroSubject:         "HERO SUBJECT",
    visualHierarchy:     "VISUAL HIERARCHY",
    composition:         "COMPOSITION",
    photography:         "PHOTOGRAPHY",
    subjectDirection:    "SUBJECT DIRECTION",
    environment:         "ENVIRONMENT",
    typography:          "TYPOGRAPHY",
    layout:              "LAYOUT",
    commercialDetails:   "COMMERCIAL DETAILS",
    negativeSpace:       "NEGATIVE SPACE",
    marketingPsychology: "MARKETING PSYCHOLOGY",
    antiPattern:         "CAMPAIGN ANTI-PATTERN",
  };
  return labels[dim] ?? dim.toUpperCase();
}

function buildExamplesSection(
  examples: ReturnType<typeof selectRelevantExamples>,
): string {
  if (examples.length === 0) return "";

  const blocks = examples.map(ex => {
    const tag   = `${dimensionLabel(ex.dimension)} (Priority ${ex.priority}/10${ex.mandatory ? " — NON-NEGOTIABLE" : ""})`;
    if (ex.dimension === "antiPattern") {
      return [
        tag,
        `  Avoid:         ${ex.bad ?? ""}`,
        `  Why it fails:  ${ex.whyBad ?? ""}`,
        `  Gold standard: ${ex.goldStandard}`,
      ].join("\n");
    }
    return `${tag}\n  ${ex.goldStandard}`;
  });

  return `KEY EXAMPLES (${examples.length} of 12 principles selected by priority):\n\n${blocks.join("\n\n")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main public function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the complete CKL + CDE context block for injection into GPT's prompt.
 * Returns an empty string if neither industry nor rawIdea is provided.
 */
export function buildCreativeContext(input: CDEContextInput): string {
  const { industry, rawIdea, campaignGoal, campaignType, audience } = input;
  if (!rawIdea && !industry) return "";

  // ── CKL: resolve campaign + industry identity ──────────────────────────────
  const { campaign, industryId, industryLabel } = getCampaignResolution(
    industry,
    rawIdea ?? "",
  );

  // ── CDE: load supporting data ──────────────────────────────────────────────
  const profile  = getDecisionProfile(industryId);
  const ruleSet  = getRulesForIndustry(industryId, campaignType ?? campaign.type);
  const pattern  = findBestPattern(industryId, campaign.type, rawIdea ?? "", audience);
  const examples = selectRelevantExamples(campaign, profile);

  // ── Assemble context block ─────────────────────────────────────────────────
  const lines: Array<string | null> = [
    `━━ CREATIVE DECISION ENGINE: ${industryLabel} › ${campaign.type.replace(/_/g, " ")} ━━`,
    ``,
    `CAMPAIGN GOAL: ${campaign.goal}`,
    `TARGET:        ${campaign.audience}`,
    campaignGoal ? `BRIEF CONTEXT: ${campaignGoal}` : null,
    ``,
    buildPrioritySection(profile.priorities),
    ``,
    buildMatrixSection(profile.matrix),
    ``,
    buildRulesSection(ruleSet.rules),
    ``,
    buildPatternSection(pattern),
    ``,
    buildExamplesSection(examples),
    ``,
    `CONVERSION INSIGHT: ${campaign.conversionInsight}`,
    ``,
    buildSelfReviewInstruction(),
    ``,
    buildCommercialScoreInstruction(),
    ``,
    `━━ END CREATIVE DECISION ENGINE ━━`,
  ];

  return lines.filter((l): l is string => l !== null).join("\n");
}
