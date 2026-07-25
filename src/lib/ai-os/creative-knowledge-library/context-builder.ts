// Creative Knowledge Library — Context Builder

import type { CKLContextInput, CampaignKnowledge, IndustryKnowledge } from "./types";
import { KNOWLEDGE_REGISTRY } from "./industries/index";
import { ADVERTISING_FAILURES } from "./anti-patterns/advertising-failures";
import { DESIGN_HEURISTICS } from "./principles/design-heuristics";

// --- Industry ID mapping from design-director IndustryCategory values ---

const INDUSTRY_TO_CKL_ID: Record<string, string> = {
  restaurant:          "food_hospitality",
  food:                "food_hospitality",
  cafe:                "food_hospitality",
  hospitality:         "food_hospitality",
  dental:              "healthcare_dental",
  healthcare:          "healthcare_dental",
  clinic:              "healthcare_dental",
  medical:             "healthcare_dental",
  real_estate:         "real_estate",
  realestate:          "real_estate",
  property:            "real_estate",
  construction:        "real_estate",
  jewelry:             "jewelry_luxury",
  jewellery:           "jewelry_luxury",
  luxury:              "jewelry_luxury",
  fashion:             "retail_fashion",
  retail:              "retail_fashion",
  ecommerce:           "retail_fashion",
  clothing:            "retail_fashion",
  finance:             "financial_services",
  financial:           "financial_services",
  banking:             "financial_services",
  insurance:           "financial_services",
  salon:               "beauty_cosmetics",
  beauty:              "beauty_cosmetics",
  cosmetics:           "beauty_cosmetics",
  spa:                 "beauty_cosmetics",
  education:           "education",
  coaching:            "education",
  school:              "education",
  fitness:             "fitness_wellness",
  gym:                 "fitness_wellness",
  wellness:            "fitness_wellness",
  yoga:                "fitness_wellness",
  automotive:          "automotive",
  automobile:          "automotive",
  car:                 "automotive",
  bike:                "automotive",
  events:              "events_entertainment",
  event:               "events_entertainment",
  wedding:             "events_entertainment",
  entertainment:       "events_entertainment",
  tech:                "tech_software",
  software:            "tech_software",
  saas:                "tech_software",
  app:                 "tech_software",
  technology:          "tech_software",
};

function resolveIndustryKnowledge(industry: string): IndustryKnowledge {
  const normalised = industry.toLowerCase().replace(/[\s-]/g, "_");

  // Direct match in registry
  if (KNOWLEDGE_REGISTRY[normalised]) return KNOWLEDGE_REGISTRY[normalised];

  // Keyword scan through mapping
  for (const [keyword, ckl_id] of Object.entries(INDUSTRY_TO_CKL_ID)) {
    if (normalised.includes(keyword)) {
      const found = KNOWLEDGE_REGISTRY[ckl_id];
      if (found) return found;
    }
  }

  // Fallback
  return KNOWLEDGE_REGISTRY["general"]!;
}

function scoreCampaign(campaign: CampaignKnowledge, rawIdea: string): number {
  const idea = rawIdea.toLowerCase();
  return campaign.tags.filter(tag => idea.includes(tag)).length;
}

function selectCampaign(industry: IndustryKnowledge, rawIdea: string): CampaignKnowledge {
  let bestScore = -1;
  let bestCampaign = industry.campaigns[0]!;

  for (const campaign of industry.campaigns) {
    const score = scoreCampaign(campaign, rawIdea);
    if (score > bestScore) {
      bestScore = score;
      bestCampaign = campaign;
    }
  }

  return bestCampaign;
}

function pickRelevantAntiPatterns(rawIdea: string, count = 3): string[] {
  const seed = rawIdea.length % ADVERTISING_FAILURES.length;
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    const ap = ADVERTISING_FAILURES[(seed + i) % ADVERTISING_FAILURES.length];
    if (ap) selected.push(`• ${ap.label}: ${ap.fix}`);
  }
  return selected;
}

function pickRelevantHeuristics(rawIdea: string, count = 2): string[] {
  const seed = Math.floor(rawIdea.length / 3) % DESIGN_HEURISTICS.length;
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    const h = DESIGN_HEURISTICS[(seed + i) % DESIGN_HEURISTICS.length];
    if (h) selected.push(`• ${h.rule}: ${h.apply}`);
  }
  return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// CDE integration: resolves campaign + industry metadata in one call
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignResolution {
  campaign:      CampaignKnowledge;
  industryId:    string;
  industryLabel: string;
}

/**
 * Resolves the best-matching CKL campaign for the given industry and idea.
 * Used by the Creative Decision Engine to access campaign knowledge without
 * going through the full context-building pipeline.
 */
export function getCampaignResolution(
  industry: string,
  rawIdea:  string,
): CampaignResolution {
  const knowledge = resolveIndustryKnowledge(industry);
  const campaign  = selectCampaign(knowledge, rawIdea);
  return {
    campaign,
    industryId:    knowledge.id,
    industryLabel: knowledge.label,
  };
}

export function buildCKLContext(input: CKLContextInput): string {
  const { industry, rawIdea } = input;
  if (!rawIdea && !industry) return "";

  const industryKnowledge = resolveIndustryKnowledge(industry);
  const campaign = selectCampaign(industryKnowledge, rawIdea ?? "");

  const lines: string[] = [
    `━━ CREATIVE REFERENCE: ${industryKnowledge.label} › ${campaign.type.replace(/_/g, " ")} ━━`,
    "",
    `CAMPAIGN GOAL: ${campaign.goal}`,
    `TARGET: ${campaign.audience}`,
    "",
    `HERO SUBJECT`,
    `  GOLD STANDARD: ${campaign.heroSubject.goldStandard}`,
    `  AVOID: ${campaign.heroSubject.bad} — ${campaign.heroSubject.whyBad}`,
    "",
    `VISUAL HIERARCHY`,
    `  GOLD STANDARD: ${campaign.visualHierarchy.goldStandard}`,
    "",
    `COMPOSITION`,
    `  GOLD STANDARD: ${campaign.composition.goldStandard}`,
    "",
    `PHOTOGRAPHY`,
    `  GOLD STANDARD: ${campaign.photography.goldStandard}`,
    `  AVOID: ${campaign.photography.bad}`,
    "",
    `SUBJECT DIRECTION`,
    `  GOLD STANDARD: ${campaign.subjectDirection.goldStandard}`,
    "",
    `ENVIRONMENT`,
    `  GOLD STANDARD: ${campaign.environment.goldStandard}`,
    `  AVOID: ${campaign.environment.bad}`,
    "",
    `TYPOGRAPHY`,
    `  GOLD STANDARD: ${campaign.typography.goldStandard}`,
    "",
    `MARKETING PSYCHOLOGY`,
    `  GOLD STANDARD: ${campaign.marketingPsychology.goldStandard}`,
    `  WHY IT CONVERTS: ${campaign.marketingPsychology.why}`,
    "",
    `COMMERCIAL DETAILS`,
    `  GOLD STANDARD: ${campaign.commercialDetails.goldStandard}`,
    "",
    `NEGATIVE SPACE`,
    `  GOLD STANDARD: ${campaign.negativeSpace.goldStandard}`,
    "",
    `CAMPAIGN ANTI-PATTERN`,
    `  AVOID: ${campaign.antiPattern.bad}`,
    `  WHY FAILS: ${campaign.antiPattern.whyBad}`,
    `  GOLD STANDARD: ${campaign.antiPattern.goldStandard}`,
    "",
    `CONVERSION INSIGHT: ${campaign.conversionInsight}`,
    "",
    `UNIVERSAL ANTI-PATTERN ALERTS:`,
    ...pickRelevantAntiPatterns(rawIdea ?? ""),
    "",
    `DESIGN HEURISTICS:`,
    ...pickRelevantHeuristics(rawIdea ?? ""),
    "",
    `━━ END CREATIVE REFERENCE ━━`,
  ];

  return lines.join("\n");
}
