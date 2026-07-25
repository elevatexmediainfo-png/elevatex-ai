// Phase 10.4.0 — Diversity Engine interface contract.
// Wraps and extends creative-knowledge/diversity-metadata/ (Phase 10.4).
//
// Phase 10.4.0: pure computation on fingerprints — no knowledge store queries.
// Phase 10.4D: will query CompositionKnowledgeNode to expand diversity dimensions
//   beyond the 4-segment fingerprint to include composition and behaviour variety.
// Phase 10.4F: will read CreativeMemoryEntry history to score semantic similarity,
//   not just exact fingerprint match.

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { PipelineContext, KnowledgeTrace } from "../types";
import type { DiversityMetadata, DiversityCheckResult } from "../../creative-knowledge/diversity-metadata/types";

export interface DiversityEngineInput extends PipelineContext {
  /** Matches HeroMomentKnowledgeNode.id — empty string until Phase 10.4.1. */
  heroId:              string;
  /** Matches ArchetypeKnowledgeNode.id. */
  archetypeId:         string;
  /** Matches SceneTypeNode.id — empty string until Phase 10.4.1. */
  sceneId:             string;
  /** From visual-layout engine. */
  layoutId:            string;
  /** From scene-planner camera builder. */
  cameraId:            string;
  /** From realism-engine physics note key. */
  lightingId:          string;
  /** From scene-planner composition builder. */
  compositionId:       string;
  /** Recent fingerprints from session memory — used for exact-match dedup. */
  recentFingerprints:  string[];
}

export interface DiversityEngineOutput {
  metadata:       DiversityMetadata;
  check:          DiversityCheckResult;
  /** 0–1: 1.0 = completely novel, 0.0 = exact duplicate. */
  diversityScore: number;
  trace:          KnowledgeTrace;
}

export type DiversityEngineRunner = (
  input: DiversityEngineInput,
  store: KnowledgeStore,
) => DiversityEngineOutput;
