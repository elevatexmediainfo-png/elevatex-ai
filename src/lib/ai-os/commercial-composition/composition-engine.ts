// Phase 8.7C — Commercial Composition Engine.
// Decides exactly WHERE every commercial asset belongs on the canvas.
// Deterministic — no AI, no randomness, no text generation.

import { getAssetDefinition } from "../commercial-assets/asset-registry";
import { normalizeIndustryId } from "../commercial-assets/adapter";
import { selectCompositionStrategy, getStrategyDefinition } from "./placement-strategies";
import { computeCrowdingScore, computeCompositionGrade } from "./layout-rules";
import type {
  CompositionInput,
  CommercialCompositionPlan,
  AssetPlacement,
  EyeFlow,
  WhitespaceSpec,
  ConflictResolution,
  ConflictType,
  LayoutRegion,
} from "./types";
import type { CommercialAssetId } from "../commercial-assets/types";

// ─────────────────────────────────────────────────────────────────────────────
// Badge-type assets — used for badge_cluster conflict detection
// ─────────────────────────────────────────────────────────────────────────────

const BADGE_ASSET_IDS = new Set<CommercialAssetId>([
  "offer_ribbon", "limited_time_badge", "discount_badge",
  "opening_badge", "festival_sticker", "award_badge", "trust_badge",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Region → replacement mapping for conflict resolution
// ─────────────────────────────────────────────────────────────────────────────

const CONFLICT_FALLBACK_REGIONS: Partial<Record<LayoutRegion, LayoutRegion>> = {
  top_right:     "footer_right",
  top_left:      "footer_left",
  top_center:    "footer_center",
  bottom_center: "above_cta",
  mid_right:     "footer_right",
  mid_left:      "footer_left",
  bottom_right:  "footer_right",
  bottom_left:   "footer_left",
};

// ─────────────────────────────────────────────────────────────────────────────
// Build placements for all assets in the plan
// ─────────────────────────────────────────────────────────────────────────────

function buildPlacements(input: CompositionInput): AssetPlacement[] {
  const { commercialAssets } = input;
  const strategyId = selectCompositionStrategy(input);
  const strategy   = getStrategyDefinition(strategyId);

  return commercialAssets.assets.map((planned) => {
    const def      = getAssetDefinition(planned.id);
    const override = strategy.assetDefaults[planned.id] ?? strategy.fallbackPlacement;

    return {
      assetId:          planned.id,
      region:           override.region,
      alignment:        override.alignment,
      safeZonePercent:  override.safeZonePercent,
      priority:         planned.priority,
      prominence:       override.prominence,
      clearSpace:       override.clearSpace,
      size:             override.size,
      stackOrder:       override.stackOrder,
      ...(override.dominancePercent !== undefined ? { dominancePercent: override.dominancePercent } : {}),
      ...(override.columns !== undefined          ? { columns: override.columns }                    : {}),
      ...(override.spacing !== undefined          ? { spacing: override.spacing }                    : {}),
    } satisfies AssetPlacement;

    void def; // registry definition available for future callers
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict detection
// ─────────────────────────────────────────────────────────────────────────────

function detectConflicts(placements: AssetPlacement[]): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];

  // ── Duplicate hierarchy: two critical/high assets in the same region ────────
  const regionMap = new Map<LayoutRegion, CommercialAssetId[]>();
  for (const p of placements) {
    const existing = regionMap.get(p.region) ?? [];
    existing.push(p.assetId);
    regionMap.set(p.region, existing);
  }

  for (const [region, assets] of regionMap) {
    if (assets.length < 2) continue;
    const criticalInRegion = placements
      .filter((p) => p.region === region && (p.prominence === "critical" || p.prominence === "high"))
      .map((p) => p.assetId);

    if (criticalInRegion.length >= 2) {
      conflicts.push({
        conflictType:   "duplicate_hierarchy" as ConflictType,
        affectedAssets: criticalInRegion,
        resolution:     `Two high-priority assets in ${region}: lower-priority asset moved to safe footer zone`,
        regionChange:   {
          asset: criticalInRegion[1]!,
          from:  region,
          to:    CONFLICT_FALLBACK_REGIONS[region] ?? "footer_center",
        },
      });
    }
  }

  // ── Logo overlapping CTA: both top_right ────────────────────────────────────
  const logoPlacement = placements.find((p) => p.assetId === "logo" || p.assetId === "builder_logo" || p.assetId === "clinic_logo");
  const ctaPlacement  = placements.find((p) => p.assetId === "cta" || p.assetId === "booking_button" || p.assetId === "appointment_button");

  if (logoPlacement && ctaPlacement && logoPlacement.region === ctaPlacement.region) {
    conflicts.push({
      conflictType:   "logo_overlaps_cta",
      affectedAssets: [logoPlacement.assetId, ctaPlacement.assetId],
      resolution:     "CTA moved to bottom_center; logo stays in original region",
      regionChange:   { asset: ctaPlacement.assetId, from: ctaPlacement.region, to: "bottom_center" },
    });
  }

  // ── QR blocking hero: QR in mid_center ─────────────────────────────────────
  const qrPlacement = placements.find((p) => p.assetId === "qr_code");
  if (qrPlacement && qrPlacement.region === "mid_center") {
    conflicts.push({
      conflictType:   "qr_blocks_hero",
      affectedAssets: ["qr_code"],
      resolution:     "QR code moved to bottom_right to clear hero zone",
      regionChange:   { asset: "qr_code", from: "mid_center", to: "bottom_right" },
    });
  }

  // ── Badge cluster: more than 2 badges in the same corner region ─────────────
  const cornerRegions: LayoutRegion[] = ["top_left", "top_right", "bottom_left", "bottom_right"];
  for (const corner of cornerRegions) {
    const badges = placements.filter((p) => BADGE_ASSET_IDS.has(p.assetId) && p.region === corner);
    if (badges.length > 2) {
      const overflow = badges.slice(2).map((p) => p.assetId);
      conflicts.push({
        conflictType:   "badge_cluster",
        affectedAssets: overflow,
        resolution:     `More than 2 badges at ${corner}: excess badges moved to footer_center`,
        regionChange:   {
          asset: overflow[0]!,
          from:  corner,
          to:    "footer_center",
        },
      });
    }
  }

  // ── Footer crowded: more than 3 assets in footer regions ────────────────────
  const footerRegions: LayoutRegion[] = ["footer_left", "footer_center", "footer_right", "bottom_left", "bottom_center", "bottom_right"];
  const footerAssets = placements.filter((p) => footerRegions.includes(p.region));
  if (footerAssets.length > 4) {
    const overflow = footerAssets.slice(4).map((p) => p.assetId);
    conflicts.push({
      conflictType:   "footer_crowded",
      affectedAssets: overflow,
      resolution:     `${footerAssets.length} assets in footer zone (max 4): least important assets removed from footer`,
    });
  }

  // ── Headline overflow risk: headline in narrow region ───────────────────────
  const headlinePlacement = placements.find((p) => p.assetId === "headline");
  if (headlinePlacement && ["mid_right", "footer_right", "footer_left"].includes(headlinePlacement.region)) {
    conflicts.push({
      conflictType:   "headline_overflow_risk",
      affectedAssets: ["headline"],
      resolution:     "Headline region changed to top_center for safe wrapping",
      regionChange:   { asset: "headline", from: headlinePlacement.region, to: "top_center" },
    });
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply conflict resolutions by mutating region assignments
// ─────────────────────────────────────────────────────────────────────────────

function resolveConflicts(
  placements:  AssetPlacement[],
  conflicts:   ConflictResolution[],
): AssetPlacement[] {
  // Build a map of assetId → new region from resolution instructions
  const regionOverrides = new Map<CommercialAssetId, LayoutRegion>();
  for (const c of conflicts) {
    if (c.regionChange) {
      regionOverrides.set(c.regionChange.asset, c.regionChange.to);
    }
  }

  return placements.map((p) => {
    const override = regionOverrides.get(p.assetId);
    return override ? { ...p, region: override } : p;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Eye flow computation
// ─────────────────────────────────────────────────────────────────────────────

function computeEyeFlow(placements: AssetPlacement[]): EyeFlow {
  // Visual weight = prominence score × size multiplier
  const prominenceScore: Record<string, number> = {
    critical: 5, high: 4, medium: 3, low: 2, subtle: 1,
  };
  const sizeMultiplier: Record<string, number> = {
    large: 1.5, medium: 1.0, small: 0.7, auto: 1.0,
  };

  const withWeight = placements.map((p) => ({
    ...p,
    visualWeight: (prominenceScore[p.prominence] ?? 1) * (sizeMultiplier[p.size] ?? 1) * (p.dominancePercent ? 1.2 : 1),
    commercialWeight: p.priority,
  }));

  const byVisual     = [...withWeight].sort((a, b) => b.visualWeight - a.visualWeight);
  const byCommercial = [...withWeight].sort((a, b) => b.commercialWeight - a.commercialWeight);

  // Primary is usually the hero zone, then headline
  const topVisual   = byVisual[0]?.assetId ?? "headline";
  const topCommercial = byCommercial[0]?.assetId ?? "cta";

  const primary   = topVisual === "headline" || topVisual === topCommercial
    ? ("hero_zone" as const)
    : topVisual;
  const secondary = byVisual[0]?.assetId ?? "headline";
  const tertiary  = byVisual[1]?.assetId ?? "cta";

  return {
    primary,
    secondary,
    tertiary,
    readingDirection: "ltr",
    visualWeightOrder:     ["hero_zone", ...byVisual.map((p) => p.assetId)],
    commercialWeightOrder: byCommercial.map((p) => p.assetId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Whitespace computation
// ─────────────────────────────────────────────────────────────────────────────

function computeWhitespace(
  input:        CompositionInput,
  placements:   AssetPlacement[],
  strategyId:   ReturnType<typeof selectCompositionStrategy>,
): WhitespaceSpec {
  const strategy     = getStrategyDefinition(strategyId);
  const defaults     = strategy.whitespaceDefaults;
  const crowdingScore = computeCrowdingScore(placements.length, defaults.density);

  return { ...defaults, crowdingScore };
}

// ─────────────────────────────────────────────────────────────────────────────
// Warnings
// ─────────────────────────────────────────────────────────────────────────────

function buildWarnings(
  placements:   AssetPlacement[],
  conflicts:    ConflictResolution[],
  whitespace:   WhitespaceSpec,
): string[] {
  const warnings: string[] = [];

  if (whitespace.crowdingScore > 70) {
    warnings.push(`crowdingScore=${whitespace.crowdingScore} — layout has too many assets; consider removing low-priority elements`);
  }
  if (conflicts.length > 3) {
    warnings.push(`${conflicts.length} conflicts detected and resolved — verify output with a human designer`);
  }

  const ctaCount = placements.filter(
    (p) => p.assetId === "cta" || p.assetId === "appointment_button" || p.assetId === "booking_button",
  ).length;
  if (ctaCount > 1) {
    warnings.push("Multiple CTA-type assets present — ensure only one is visually dominant");
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine function
// ─────────────────────────────────────────────────────────────────────────────

export function buildCommercialCompositionPlan(input: CompositionInput): CommercialCompositionPlan {
  const strategyId  = selectCompositionStrategy(input);
  const strategyDef = getStrategyDefinition(strategyId);

  // Step 1: Initial placements
  const rawPlacements   = buildPlacements(input);

  // Step 2: Detect conflicts
  const conflicts       = detectConflicts(rawPlacements);

  // Step 3: Resolve conflicts (region reassignments)
  const placements      = resolveConflicts(rawPlacements, conflicts);

  // Step 4: Eye flow
  const eyeFlow         = computeEyeFlow(placements);

  // Step 5: Whitespace
  const whitespace      = computeWhitespace(input, placements, strategyId);

  // Step 6: Grade + warnings
  const compositionGrade = computeCompositionGrade(whitespace.crowdingScore, conflicts.length);
  const warnings         = buildWarnings(placements, conflicts, whitespace);

  return {
    strategyId,
    heroZone:    strategyDef.heroZone,
    placements,
    eyeFlow,
    whitespace,
    safeZoneMap: strategyDef.safeZones,
    conflicts,
    compositionGrade,
    totalAssets: placements.length,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: build from blueprint inputs (used by the blueprint builder)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCompositionFromBlueprintInputs(
  strategy:         CompositionInput["strategy"],
  commercialAssets: CompositionInput["commercialAssets"],
  layoutPlan:       CompositionInput["layoutPlan"],
): CommercialCompositionPlan {
  const industry = normalizeIndustryId(
    strategy.business.industry.value,
    strategy.business.subIndustry.value,
  );
  return buildCommercialCompositionPlan({ strategy, commercialAssets, layoutPlan, industry });
}
