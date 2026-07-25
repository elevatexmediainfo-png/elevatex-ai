// Phase 10.4C — Route Evaluation Context Builder.
//
// Translates the rich CreativeStrategy + CampaignPlan + AssetIntelligence
// outputs (produced by Phases 4–5) into the RouteEvaluationContext that
// evaluateIntelligence() needs.
//
// Phase 10.4B used a minimal 3-signal context (industry + goal + rawIdea).
// Phase 10.4C upgrades to all available signals so the engine can use its
// full 7-dimension scoring:
//   audience.tier     → audienceMatch scorer
//   luxuryTier        → audienceMatch + commercialScore
//   psychology        → psychologyMatch scorer
//   campaign.urgency  → commercialScore urgency boost
//   campaign.keyMessages → signal completeness → confidence scorer
//   business.hasBrandKit → confidence scorer
//   season.month      → seasonal boost scorer
//   referenceImage    → imageDiversityScore scorer
//
// Pure function — no I/O, no side effects, fully testable.

import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { AssetIntelligence } from "../../types";
import type { MaterialTier } from "../../prompt-spec/material-engine";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { CampaignGoal } from "../types";
import type {
  RouteEvaluationContext,
  CampaignSignal,
  BusinessSignal,
} from "./types";
import type {
  AudienceSignal,
  PsychologySignal,
  ReferenceImageSignal,
  SeasonSignal,
  Month,
} from "../route-engine/types";

// ── Private mapping helpers ─────────────────────────────────────────────────────

const GOAL_MAP: Partial<Record<string, CampaignGoal>> = {
  lead_generation: "conversion",
  sales:           "conversion",
};

/** Creative Brain campaign goal → RouteEvaluationContext CampaignGoal. */
function mapGoal(raw: string): CampaignGoal {
  return (GOAL_MAP[raw] ?? raw) as CampaignGoal;
}

/** Creative Brain urgency → CampaignSignal.urgency (undefined if no urgency). */
function mapUrgency(raw: string): "high" | "medium" | "low" | undefined {
  if (raw === "none" || raw === "unknown") return undefined;
  if (raw === "immediate" || raw === "high") return "high";
  if (raw === "medium") return "medium";
  if (raw === "low") return "low";
  return undefined;
}

/** Creative Brain income group → MaterialTier. */
function mapIncomeToTier(raw: string): MaterialTier | undefined {
  if (raw === "budget") return "mass";
  if (raw === "mid_market") return "mid";
  if (raw === "affluent" || raw === "high_net_worth") return "luxury";
  return undefined;
}

/** Creative Brain luxury level → MaterialTier. */
function mapLuxuryToTier(raw: string): MaterialTier | undefined {
  if (raw === "none" || raw === "low") return "mass";
  if (raw === "medium") return "mid";
  if (raw === "high" || raw === "ultra_luxury") return "luxury";
  return undefined;
}

/** Creative Brain age group → [minAge, maxAge]. */
function mapAgeGroup(raw: string): [number, number] | undefined {
  const MAP: Partial<Record<string, [number, number]>> = {
    "18-24": [18, 24],
    "25-34": [25, 34],
    "35-44": [35, 44],
    "45-54": [45, 54],
    "55+":   [55, 99],
  };
  return MAP[raw];
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Build a RouteEvaluationContext from all signals available after Phases 4–5.
 *
 * Call this BEFORE the LLM prompt-building steps (buildCreativeBrief,
 * buildUniversalPromptFromIdea) so route intelligence evaluates the right
 * route before the prompt is locked in.
 *
 * @param strategy   Phase 4 — Creative Brain output.
 * @param plan       Phase 5 — Creative Director / Campaign Plan output.
 * @param assets     Phase 3 — Asset Understanding Engine output.
 * @param rawIdea    The user's original idea string.
 */
export function buildRouteContext(
  strategy: CreativeStrategy,
  plan:     CampaignPlan,
  assets:   AssetIntelligence,
  rawIdea:  string,
): RouteEvaluationContext {
  const rawGoal    = strategy.marketing.campaignGoal.value;
  const rawUrgency = strategy.communication.urgency.value;

  // ── Campaign signal ──────────────────────────────────────────────────────────
  const coreMessage = plan.concept.coreMessage.value;
  const keyMessages = coreMessage && coreMessage !== "unknown"
    ? [coreMessage]
    : undefined;

  const campaign: CampaignSignal = {
    goal:        mapGoal(rawGoal),
    urgency:     mapUrgency(rawUrgency),
    ...(keyMessages ? { keyMessages } : {}),
  };

  // ── Audience signal ──────────────────────────────────────────────────────────
  const audienceTier = mapIncomeToTier(strategy.audience.incomeGroup.value);
  const ageRange     = mapAgeGroup(strategy.audience.ageGroup.value);
  const audience: AudienceSignal | undefined =
    audienceTier || ageRange
      ? { ...(audienceTier ? { tier: audienceTier } : {}), ...(ageRange ? { ageRange } : {}) }
      : undefined;

  // ── Luxury tier signal ───────────────────────────────────────────────────────
  const luxuryTier = mapLuxuryToTier(strategy.visual.luxuryLevel.value);

  // ── Psychology signal — sourced from Campaign Plan emotional hook ────────────
  const emotionalHook = plan.concept.emotionalHook.value;
  const psychology: PsychologySignal | undefined =
    emotionalHook && emotionalHook !== "unknown"
      ? {
          primaryExperience: emotionalHook,
          intensity:         mapUrgency(rawUrgency) ?? "medium",
        }
      : undefined;

  // ── Business signal — brand voice from brand kit ────────────────────────────
  // BusinessSignal.brandVoice carries brand-kit personality hints for scorer use.
  // Include the signal only when there's something meaningful to pass.
  const brandVoice: string[] = [];
  if (assets.brandContext?.fontFamily) brandVoice.push(assets.brandContext.fontFamily);
  const business: BusinessSignal | undefined =
    brandVoice.length > 0 ? { brandVoice } : undefined;

  // ── Season signal — current calendar month ───────────────────────────────────
  const season: SeasonSignal = {
    month: (new Date().getMonth() + 1) as Month,
  };

  // ── Reference image signal ───────────────────────────────────────────────────
  const ref = assets.referenceAnalysis;
  const referenceImage: ReferenceImageSignal | undefined = ref?.style
    ? { detectedComposition: ref.style }
    : undefined;

  return {
    industry: strategy.business.industry.value as SceneIndustry,
    campaign,
    rawIdea,
    ...(audience       ? { audience }       : {}),
    ...(luxuryTier     ? { luxuryTier }     : {}),
    ...(psychology     ? { psychology }     : {}),
    ...(business       ? { business }       : {}),
    season,
    ...(referenceImage ? { referenceImage } : {}),
  };
}
