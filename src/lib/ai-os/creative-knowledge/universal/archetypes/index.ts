// Phase 10.4A — Universal Archetype Platform public API.
// Import from here; never import sub-file paths directly.
//
// This supersedes creative-knowledge/archetype-registry/ (Phase 10.4).
// Old registry stays in place for backward compat; new platform lives here.

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ArchetypeCategory,
  CommercialIntent,
  CommercialPurpose,
  PsychologicalMechanism,
  PsychologicalPurpose,
  IncomeGroup,
  AgeGroup,
  BuyerStage,
  AudienceProfile,
  ArchetypeFutureScore,
  UniversalArchetype,
  ArchetypeFilter,
} from "./types";

export { EMPTY_ARCHETYPE_FUTURE_SCORE } from "./types";

// ── Registry ──────────────────────────────────────────────────────────────────
export {
  register,
  registerAll,
  getById,
  getByCategory,
  getForIndustry,
  getForCampaign,
  getForContext,
  getForBuyerStage,
  query,
  size,
  categories,
  coverageReport,
} from "./registry";

// ── Schema (optional runtime validation) ─────────────────────────────────────
export { UniversalArchetypeSchema, validateArchetype } from "./schema";
export type { UniversalArchetypeData } from "./schema";

// ── Data (populated Phase 10.4.1+) ───────────────────────────────────────────
// Knowledge entries are NOT imported or registered here.
// Each industry knowledge file registers its entries at module load time.
// This keeps the platform lazy — no entries loaded until the store is initialised.
