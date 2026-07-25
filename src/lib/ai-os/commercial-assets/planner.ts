// Phase 8.7A — Commercial Asset Planner.
// Deterministic engine: decides WHICH assets should exist, in what priority order.
// NEVER generates text, prompts, copy, or image instructions.
// Input → JSON plan. That is all.

import { getAssetDefinition } from "./asset-registry";
import { getRulesForIndustry } from "./industry-rules";
import type {
  AssetPlannerInput,
  CommercialAssetId,
  CommercialAssetPlan,
  PlannedAsset,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Objective → optional asset boosts
// These assets are included from the optional list when the objective matches.
// ─────────────────────────────────────────────────────────────────────────────

const OBJECTIVE_ASSET_BOOSTS: Record<string, CommercialAssetId[]> = {
  lead_generation:    ["phone", "whatsapp", "appointment_button", "booking_button", "qr_code"],
  brand_awareness:    ["social_icons", "logo", "award_badge", "trust_badge"],
  direct_sale:        ["offer_ribbon", "discount_badge", "limited_time_badge", "price_tag"],
  appointment_booking:["appointment_button", "phone", "whatsapp", "qr_code"],
  footfall:           ["address", "qr_code", "phone", "offer_ribbon"],
  event_attendance:   ["booking_button", "address", "qr_code", "limited_time_badge"],
  trust_building:     ["trust_badge", "certification", "award_badge", "review_stars", "google_rating"],
  product_launch:     ["opening_badge", "offer_ribbon", "social_icons", "award_badge"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Brand type filters
// Luxury brands suppress promotional clutter; affordable brands accept it.
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_TYPE_SUPPRESS: Record<string, CommercialAssetId[]> = {
  luxury:       ["discount_badge", "offer_ribbon", "limited_time_badge", "festival_sticker", "price_tag"],
  premium:      ["discount_badge", "festival_sticker"],
  professional: ["festival_sticker"],
  mass_market:  [],
  affordable:   [],
  startup:      [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Offer presence → promotional assets
// When the input includes an offer, these optional assets are activated.
// ─────────────────────────────────────────────────────────────────────────────

const OFFER_TRIGGER_ASSETS: CommercialAssetId[] = [
  "offer_ribbon",
  "limited_time_badge",
  "discount_badge",
];

// ─────────────────────────────────────────────────────────────────────────────
// Priority boost amounts applied on top of registry base priority
// Used to rank assets within the output priority array.
// ─────────────────────────────────────────────────────────────────────────────

function computeEffectivePriority(
  assetId: CommercialAssetId,
  input:   AssetPlannerInput,
  isMandatory: boolean,
): number {
  const def = getAssetDefinition(assetId);
  let score = def.priority * 10; // base 10–100

  if (isMandatory) score += 50;

  const boosts = OBJECTIVE_ASSET_BOOSTS[input.commercialObjective] ?? [];
  if (boosts.includes(assetId)) score += 20;

  if (input.offer && OFFER_TRIGGER_ASSETS.includes(assetId)) score += 15;

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main planner function
// ─────────────────────────────────────────────────────────────────────────────

export function planCommercialAssets(input: AssetPlannerInput): CommercialAssetPlan {
  const rules = getRulesForIndustry(input.industry);

  const suppressed = new Set<CommercialAssetId>(
    BRAND_TYPE_SUPPRESS[input.brandType] ?? [],
  );

  // Forbidden = industry never list
  const forbidden = new Set<CommercialAssetId>(rules.never);

  // Mandatory = industry must list, minus any suppressed by brand type
  // (suppressed mandatory assets are demoted to optional — never removed entirely
  //  since they're compliance requirements; brand type can only demote promotional
  //  assets, not industry-mandated ones — so suppression only acts on optionals)
  const mandatoryIds: CommercialAssetId[] = rules.must.filter(
    (id) => !forbidden.has(id),
  );

  // Objective boosts — pull relevant optional assets into selection
  const objectiveBoosts = new Set<CommercialAssetId>(
    OBJECTIVE_ASSET_BOOSTS[input.commercialObjective] ?? [],
  );

  // Offer triggers — activate promo assets if an offer is present
  const offerActivated = input.offer
    ? new Set<CommercialAssetId>(OFFER_TRIGGER_ASSETS)
    : new Set<CommercialAssetId>();

  // Select optional assets: include if boosted by objective or offer, and not suppressed/forbidden
  const selectedOptionalIds: CommercialAssetId[] = rules.optional.filter((id) => {
    if (forbidden.has(id)) return false;
    if (suppressed.has(id)) return false;
    if (objectiveBoosts.has(id)) return true;
    if (offerActivated.has(id)) return true;
    return false;
  });

  // Remaining optionals (available but not selected this run)
  const selectedOptionalSet = new Set(selectedOptionalIds);
  const remainingOptional: CommercialAssetId[] = rules.optional.filter(
    (id) => !selectedOptionalSet.has(id) && !forbidden.has(id),
  );

  // Build planned assets list
  const allSelected: CommercialAssetId[] = [
    ...mandatoryIds,
    ...selectedOptionalIds,
  ];

  // Deduplicate (mandatory and optional overlap guard)
  const seen = new Set<CommercialAssetId>();
  const dedupedSelected: CommercialAssetId[] = [];
  for (const id of allSelected) {
    if (!seen.has(id)) {
      seen.add(id);
      dedupedSelected.push(id);
    }
  }

  const mandatorySet = new Set(mandatoryIds);
  const plannedAssets: PlannedAsset[] = dedupedSelected.map((id) => {
    const def = getAssetDefinition(id);
    return {
      id,
      priority:             def.priority,
      mandatory:            mandatorySet.has(id),
      commercialImportance: def.commercialImportance,
      visualImportance:     def.visualImportance,
      placementImportance:  def.placementImportance,
    };
  });

  // Sort by effective priority (descending)
  const priorityOrdered: CommercialAssetId[] = [...dedupedSelected].sort(
    (a, b) =>
      computeEffectivePriority(b, input, mandatorySet.has(b)) -
      computeEffectivePriority(a, input, mandatorySet.has(a)),
  );

  return {
    assets:    plannedAssets,
    priority:  priorityOrdered,
    mandatory: mandatoryIds,
    optional:  remainingOptional,
    forbidden: [...forbidden],
  };
}
