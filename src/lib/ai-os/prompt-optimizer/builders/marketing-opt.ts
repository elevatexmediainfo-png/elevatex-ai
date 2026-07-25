import type { PromptSpecification } from "../../prompt-spec/types";

// Builder 8 — Marketing Optimization
// Reviews the marketing section and produces an optimized version that
// emphasises campaign objective, audience, trust, and conversion intent
// without changing the original marketing intent.
//
// Returns a description of what was optimized (no mutation of the spec here;
// compression.ts handles the actual spec changes).

export interface MarketingOptimizationReport {
  campaignGoalStrengthened: boolean;
  trustSignalAmplified: boolean;
  conversionIntentSharpened: boolean;
  audienceSpecified: boolean;
  optimizationNotes: string[];
}

export function buildMarketingOptimizationReport(spec: PromptSpecification): MarketingOptimizationReport {
  const notes: string[] = [];
  let campaignGoalStrengthened = false;
  let trustSignalAmplified = false;
  let conversionIntentSharpened = false;
  let audienceSpecified = false;

  const campaignGoal = spec.marketing.campaignGoal.value;
  const trustStrategy = spec.marketing.trustStrategy.value;
  const conversionIntent = spec.marketing.conversionIntent.value;
  const targetAudience = spec.marketing.targetAudience.value;

  // Campaign goal evaluation
  if (campaignGoal !== "unknown") {
    if (spec.marketing.campaignGoal.confidence === "medium" || spec.marketing.campaignGoal.confidence === "low") {
      campaignGoalStrengthened = true;
      notes.push(`Campaign goal "${campaignGoal}" was present but at ${spec.marketing.campaignGoal.confidence} confidence — the image must still communicate this goal visually`);
    }
  } else {
    notes.push("WARNING: Campaign goal unknown — the image may fail to communicate a clear marketing objective");
  }

  // Trust signal evaluation
  if (trustStrategy !== "unknown") {
    if (trustStrategy.includes("credentials_first") || trustStrategy.includes("authority")) {
      trustSignalAmplified = true;
      notes.push(`Trust strategy "${trustStrategy}" requires trust signals to be visually prominent — ensure trust objects appear in hero zone, not footer`);
    }
  }

  // Conversion intent sharpening
  if (conversionIntent !== "unknown" && conversionIntent.length > 50) {
    conversionIntentSharpened = true;
    notes.push(`Conversion intent is specific — the visual CTA zone and image composition must make this action feel like the natural next step`);
  } else if (conversionIntent === "unknown") {
    notes.push("Conversion intent not specified — the image may not drive a specific action");
  }

  // Audience specificity
  if (targetAudience !== "unknown") {
    audienceSpecified = true;
    const audienceWords = targetAudience.split(" ").length;
    if (audienceWords < 5) {
      notes.push(`Target audience "${targetAudience}" is broadly defined — more specific audience signals would improve targeting effectiveness`);
    }
  } else {
    notes.push("Target audience not specified — the image will be designed for a general audience");
  }

  return { campaignGoalStrengthened, trustSignalAmplified, conversionIntentSharpened, audienceSpecified, optimizationNotes: notes };
}
