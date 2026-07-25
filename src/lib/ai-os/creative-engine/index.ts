// Phase 10.4.0 — Creative Engine public API.
// Import all engine types from here; never import sub-module paths directly.
// Engine implementations (engine.ts) are delivered in Phase 10.4.1+.

// ── Shared pipeline types ─────────────────────────────────────────────────────
export type {
  ExperienceType,
  HeroType,
  IndustryCluster,
  PipelineContext,
  KnowledgeTrace,
} from "./types";

// ── Experience Engine ─────────────────────────────────────────────────────────
export type {
  ExperienceEngineInput,
  ExperienceEngineOutput,
  ExperienceEngineRunner,
} from "./experience-engine/types";

// ── Psychology Engine ─────────────────────────────────────────────────────────
export type {
  PsychologyEngineInput,
  PsychologyEngineOutput,
  PsychologyEngineRunner,
  PsychologyTrigger,
} from "./psychology-engine/types";

// ── Archetype Selector ────────────────────────────────────────────────────────
export type {
  ArchetypeSelectorInput,
  ArchetypeSelectorOutput,
  ArchetypeSelectorRunner,
  SelectedArchetype,
} from "./archetype-selector/types";

// ── Hero Generator ────────────────────────────────────────────────────────────
export type {
  HeroGeneratorInput,
  HeroGeneratorOutput,
  HeroGeneratorRunner,
  HeroSource,
} from "./hero-generator/types";

// ── Route Engine ──────────────────────────────────────────────────────────────
export type {
  RouteEngineInput,
  RouteEngineOutput,
  RouteEngineRunner,
  RouteScore,
  RouteCandidate,
} from "./route-engine/types";

// ── Diversity Engine ──────────────────────────────────────────────────────────
export type {
  DiversityEngineInput,
  DiversityEngineOutput,
  DiversityEngineRunner,
} from "./diversity-engine/types";

// ── Memory Engine ─────────────────────────────────────────────────────────────
export type {
  MemoryWriteInput,
  MemoryWriteOutput,
  MemoryWriteRunner,
  MemoryReadInput,
  MemoryReadOutput,
  MemoryReadRunner,
} from "./memory-engine/types";

// ── Validation Engine ─────────────────────────────────────────────────────────
export type {
  ValidationEngineInput,
  ValidationEngineOutput,
  ValidationEngineRunner,
  ValidationViolation,
  ViolationSeverity,
} from "./validation-engine/types";
