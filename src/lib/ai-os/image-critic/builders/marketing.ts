import type { ImageCriticInput, MarketingEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";

// Domain 4 — Marketing Evaluation.
// Evaluates whether the image supports the intended marketing goal.
// Source: spec_inference + generation_metadata

function buildCampaignGoalSupport(input: ImageCriticInput): EvaluationField<"strong" | "moderate" | "weak" | "missing" | "unknown"> {
  const mission = input.promptSpec?.mission;
  if (!mission?.whyItMatters?.value && !mission?.whatToGenerate?.value) {
    return ef("unknown", "low", "No generation mission found in PromptSpec", "spec_inference");
  }

  const quality = input.generationResult?.quality;
  const generatedOk = input.generationResult?.status === "success";

  if (!generatedOk) {
    return ef("missing", "high",
      "Generation failed — campaign goal cannot be supported by a failed image",
      "generation_metadata");
  }

  if (quality?.fullPromptUsed && quality?.allFeaturesSupported) {
    return ef("strong", "medium",
      `Full prompt used and all features supported — campaign goal "${mission.whyItMatters?.value}" strongly supported`,
      "generation_metadata");
  }

  if (quality?.fullPromptUsed && !quality?.allFeaturesSupported) {
    return ef("moderate", "medium",
      `Full prompt used but some features not supported — campaign goal moderately supported`,
      "generation_metadata");
  }

  if (!quality?.fullPromptUsed) {
    return ef("weak", "medium",
      "Prompt was truncated — some campaign goal elements may have been lost",
      "generation_metadata");
  }

  return ef("moderate", "low",
    `Campaign goal "${mission.whyItMatters.value}" — moderate support assumed from successful generation`,
    "spec_inference");
}

function buildAudienceResonance(input: ImageCriticInput): EvaluationField<"high" | "moderate" | "low" | "unknown"> {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  if (!understanding) {
    return ef("unknown", "low", "No user understanding in Blueprint", "spec_inference");
  }

  const audienceType = (understanding as { audienceType?: { value?: string } }).audienceType?.value ?? "";
  const trustReq     = (understanding as { trustRequirement?: { value?: string } }).trustRequirement?.value ?? "";
  const quality      = input.generationResult?.quality?.estimatedOutputQuality ?? 70;

  if (quality >= 80 && (audienceType || trustReq)) {
    return ef("high", "medium",
      `Provider quality ${quality}/100 with defined audience type "${audienceType}" — high resonance expected`,
      "generation_metadata");
  }
  if (quality >= 65) {
    return ef("moderate", "medium",
      `Provider quality ${quality}/100 — moderate audience resonance expected`,
      "generation_metadata");
  }

  return ef("low", "low",
    `Provider quality ${quality}/100 is below optimal — audience resonance may be limited`,
    "generation_metadata");
}

function buildTrustSignals(input: ImageCriticInput): EvaluationField<"strong" | "moderate" | "weak" | "missing" | "unknown"> {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  const trustReq = (understanding as { trustRequirement?: { value?: string } } | undefined)?.trustRequirement?.value ?? "";

  if (!trustReq || trustReq === "none" || trustReq === "low") {
    return ef("missing", "high",
      `Trust signals not required for this campaign (requirement: "${trustReq}")`,
      "spec_inference");
  }

  const industry = (understanding as { industry?: { value?: string } } | undefined)?.industry?.value ?? "";
  const highTrustIndustries = ["medical", "dental", "finance", "legal", "healthcare"];
  const isHighTrust = highTrustIndustries.some(i => industry.toLowerCase().includes(i));

  const quality = input.generationResult?.quality;
  if (isHighTrust && quality?.fullPromptUsed) {
    return ef("strong", "medium",
      `High-trust industry "${industry}" with full prompt — trust signals expected to be present`,
      "generation_metadata");
  }
  if (isHighTrust) {
    return ef("moderate", "low",
      `High-trust industry "${industry}" — trust signals partially expected`,
      "spec_inference");
  }

  return ef("moderate", "low",
    `Trust level "${trustReq}" required — moderate trust signals expected`,
    "spec_inference");
}

function buildConversionSupport(input: ImageCriticInput): EvaluationField<"strong" | "moderate" | "weak" | "missing" | "unknown"> {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  const intent = (understanding as { intent?: { value?: string } } | undefined)?.intent?.value ?? "";

  if (intent.includes("awareness") || intent.includes("informative")) {
    return ef("weak", "medium",
      `Intent "${intent}" — this campaign is not optimized for direct conversion; low conversion support is expected`,
      "spec_inference");
  }
  if (intent.includes("promotional") || intent.includes("lead_gen") || intent.includes("sale")) {
    const quality = input.generationResult?.quality;
    if (quality?.fullPromptUsed) {
      return ef("strong", "medium",
        `Promotional intent "${intent}" with full prompt used — strong conversion support expected`,
        "generation_metadata");
    }
    return ef("moderate", "low",
      `Promotional intent "${intent}" but prompt may have been truncated`,
      "generation_metadata");
  }

  return ef("unknown", "low", "Conversion support cannot be determined without intent information", "spec_inference");
}

function buildMarketingScore(
  campaignGoalSupport: EvaluationField<string>,
  audienceResonance:   EvaluationField<string>,
  trustSignals:        EvaluationField<string>,
  conversionSupport:   EvaluationField<string>
): EvaluationScore {
  const goalScore = campaignGoalSupport.value === "strong" ? 90
    : campaignGoalSupport.value === "moderate" ? 72
    : campaignGoalSupport.value === "weak" ? 50
    : campaignGoalSupport.value === "missing" ? 20
    : 60;

  const audienceScore = audienceResonance.value === "high" ? 90
    : audienceResonance.value === "moderate" ? 72
    : audienceResonance.value === "low" ? 50
    : 60;

  const trustScore = trustSignals.value === "strong" ? 90
    : trustSignals.value === "moderate" ? 75
    : trustSignals.value === "weak" ? 55
    : trustSignals.value === "missing" ? 75 // not required = not a defect
    : 65;

  const conversionScore = conversionSupport.value === "strong" ? 90
    : conversionSupport.value === "moderate" ? 72
    : conversionSupport.value === "weak" ? 65 // weak may be intentional
    : conversionSupport.value === "missing" ? 30
    : 60;

  const score = Math.round(
    (goalScore * 0.35) + (audienceScore * 0.25) + (trustScore * 0.20) + (conversionScore * 0.20)
  );

  return ef(
    score,
    "medium",
    `Marketing score ${score}/100 — goal ${goalScore}, audience ${audienceScore}, trust ${trustScore}, conversion ${conversionScore}`,
    "rule_based"
  );
}

export function buildMarketingEvaluation(input: ImageCriticInput): MarketingEvaluation {
  const campaignGoalSupport = buildCampaignGoalSupport(input);
  const audienceResonance   = buildAudienceResonance(input);
  const trustSignals        = buildTrustSignals(input);
  const conversionSupport   = buildConversionSupport(input);
  const marketingScore      = buildMarketingScore(
    campaignGoalSupport, audienceResonance, trustSignals, conversionSupport
  );

  return { campaignGoalSupport, audienceResonance, trustSignals, conversionSupport, marketingScore };
}
