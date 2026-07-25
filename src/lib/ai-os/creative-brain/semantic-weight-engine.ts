import type { UserUnderstanding, AssetIntelligence } from "../types";
import type { ExperienceProfile, SemanticWeights } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Semantic Weight Engine
// Assigns confidence weights to competing signal sources, determining which
// signals should dominate the hero decision.
// Pure function — no I/O, deterministic.
// ─────────────────────────────────────────────────────────────────────────────

export function computeSemanticWeights(
  uu:         UserUnderstanding,
  ai:         AssetIntelligence,
  experience: ExperienceProfile,
): SemanticWeights {
  // Asset weight: reference image with a heroSubject is the strongest signal
  const refHero = (ai.reference as Record<string, unknown> | undefined)
    ?.heroSubject as { value?: string } | undefined;
  const hasReferenceHero = !!(refHero?.value && refHero.value !== "unknown");
  const assetWeight = hasReferenceHero ? 1.0 : 0.0;

  // Industry weight: industry is always known to some degree (foundation signal)
  const industryKnown = uu.industry.value !== "unknown";
  const industryWeight = industryKnown
    ? (uu.industry.confidence === "high" ? 0.6 : 0.4)
    : 0.2;

  // Campaign weight: based on confidence of marketing goal resolution
  const hasExplicitGoal = uu.businessGoal.value !== "unknown" && uu.intent.value !== "unknown";
  const campaignWeight = hasExplicitGoal
    ? (experience.confidence === "high" ? 0.5 : 0.35)
    : 0.2;

  // Audience weight: boosted when user explicitly stated their audience
  const audienceExplicit = uu.audienceType.value !== "unknown" && uu.audienceType.confidence === "high";
  const audienceWeight = audienceExplicit ? 0.5 : 0.15;

  // Intent weight: strong intent signals override industry defaults
  const hasSpecificIntent = [
    "before_after", "testimonial", "lead_generation", "product_showcase",
    "educational", "event_announcement",
  ].includes(uu.intent.value);
  const intentWeight = hasSpecificIntent
    ? (uu.intent.confidence === "high" ? 0.6 : 0.4)
    : 0.2;

  // Dominant signal: asset → audience → campaign/intent → industry
  let dominantSignal: SemanticWeights["dominantSignal"];
  if (assetWeight >= 0.8) {
    dominantSignal = "asset";
  } else if (audienceWeight >= 0.4) {
    dominantSignal = "audience";
  } else if (intentWeight >= 0.5 && intentWeight >= campaignWeight) {
    dominantSignal = "intent";
  } else if (campaignWeight >= 0.4) {
    dominantSignal = "campaign";
  } else {
    dominantSignal = "industry";
  }

  const reasoning = `Dominant signal: "${dominantSignal}" (asset=${assetWeight.toFixed(2)}, intent=${intentWeight.toFixed(2)}, campaign=${campaignWeight.toFixed(2)}, audience=${audienceWeight.toFixed(2)}, industry=${industryWeight.toFixed(2)})`;

  return {
    industryWeight,
    campaignWeight,
    audienceWeight,
    intentWeight,
    assetWeight,
    dominantSignal,
    reasoning,
  };
}
