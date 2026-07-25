// Generation Mode System: public API.
//
// Two generation modes:
//   "deterministic" — same input → same output
//   "exploration"   — same brief → different creative execution every time
//
// Primary entry points:
//   buildExplorationFilter(config, recentHashes) — compile the active filter
//   selectExplorationCandidate(ranked, filter)   — diversity walk + selection
//   selectDeterministicCandidate(ranked, config) — stable top-1 selection
//   computeIntentSignature(context)              — hash the brief
//   computeExecutionSignature(candidate)         — hash the execution
//
// Integration with route-intelligence:
//   RouteIntelligenceOptions.mode         → "deterministic" | "exploration"
//   RouteIntelligenceOptions.modeConfig   → DeterministicConfig | ExplorationConfig
//   RouteIntelligenceResult.modeResult    → ModeExecutionResult

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  GenerationMode,
  DeterministicConfig,
  ExplorationConfig,
  GenerationModeConfig,
  IntentSignature,
  ExecutionSignature,
  RejectionReason,
  CandidateRejection,
  ModeExecutionResult,
  ExplorationFilter,
  ExplorationSelectionResult,
} from "./types";

export {
  DEFAULT_DETERMINISTIC_CONFIG,
  DEFAULT_EXPLORATION_CONFIG,
} from "./types";

// ── Intent / Execution signatures ─────────────────────────────────────────────
export {
  computeIntentSignature,
  intentSignaturesMatch,
  parseIntentSignatureHash,
  computeExecutionSignature,
  executionSignaturesMatch,
  shareHeroMoment,
  shareSceneType,
  parseExecutionHashes,
} from "./intent";

// ── Exploration ────────────────────────────────────────────────────────────────
export {
  buildExplorationFilter,
  applyPatternBoosts,
  findRejectionReason,
  relaxFilter,
  filterIsFullyRelaxed,
  selectExplorationCandidate,
  selectDeterministicCandidate,
} from "./exploration";
