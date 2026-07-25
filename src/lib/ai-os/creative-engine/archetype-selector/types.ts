// Phase 10.4.0 — Archetype Selector interface contract.
// Replaces creative-brain/creative-matrix.ts cluster → archetype mapping.
//
// Migration plan (Phase 10.4.0D):
//   Hardcoded cluster rules          →  ArchetypeKnowledgeNode.compatibleIndustries
//   INDUSTRY_ARCHETYPE_AFFINITY map  →  affinityScore derived from node.weight
//   selectVisualArchetype() logic    →  engine run() function
//   Creative Matrix decision table   →  store.query({ kind: "archetype", industry, campaignGoal })
//
// After migration: creative-brain/creative-matrix.ts delegates to run() here.
// Knowledge store query: filter by kind "archetype" + industry + campaignGoal,
// sort by commercialScore descending; pick highest scoring compatible entry.

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { IndustryCluster, ExperienceType, PipelineContext, KnowledgeTrace } from "../types";

export interface ArchetypeSelectorInput extends PipelineContext {
  /** Industry cluster resolved by Creative Matrix. */
  cluster:       IndustryCluster;
  primary:       ExperienceType;
  secondary:     ExperienceType | "none";
  campaignType?: string;
}

export interface SelectedArchetype {
  /** Matches ArchetypeKnowledgeNode.id. */
  id:         string;
  name:       string;
  category:   string;
  confidence: "high" | "medium" | "low";
}

export interface ArchetypeSelectorOutput {
  selected:     SelectedArchetype;
  /** Next-best archetypes for diversity fallback. */
  alternatives: SelectedArchetype[];
  reasoning:    string;
  trace:        KnowledgeTrace;
}

export type ArchetypeSelectorRunner = (
  input: ArchetypeSelectorInput,
  store: KnowledgeStore,
) => ArchetypeSelectorOutput;
