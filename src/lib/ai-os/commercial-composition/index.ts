export { buildCommercialCompositionPlan, buildCompositionFromBlueprintInputs } from "./composition-engine";
export { selectCompositionStrategy, getStrategyDefinition }                    from "./placement-strategies";
export { computeCrowdingScore, computeCompositionGrade }                       from "./layout-rules";
export type {
  LayoutRegion,
  AlignmentX,
  AssetSize,
  Density,
  Prominence,
  CompositionGrade,
  ReadingDirection,
  CompositionStrategyId,
  AssetPlacement,
  HeroZone,
  EyeFlow,
  WhitespaceSpec,
  SafeZoneMap,
  ConflictType,
  ConflictResolution,
  CommercialCompositionPlan,
  CompositionInput,
  StrategyDefinition,
  AssetPlacementDefaults,
} from "./types";
