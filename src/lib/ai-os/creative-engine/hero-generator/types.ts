// Phase 10.4.0 — Hero Generator interface contract.
// Replaces creative-brain/hero-decision-engine.ts HERO_SUBJECTS dispatch table.
//
// Migration plan (Phase 10.4.0E):
//   HERO_SUBJECTS[type][industry] table  →  HeroMomentKnowledgeNode per industry
//   resolveHeroType() logic              →  engine run() queries by kind "hero_moment"
//                                            filtered by industry + campaignTypeIds
//
// After migration: hero-decision-engine.ts delegates to run() here.
//
// Key fix this enables (Phase 10.3E audit):
//   Currently 5 restaurant campaign types collapse to 1 generic hero subject.
//   With HeroMomentKnowledgeNode entries, each campaign type gets its own node —
//   date_night, chef_story, grand_opening, signature_dish, family_dining all
//   resolve to distinct hero subjects instead of falling through to lifestyle._default.
//
// Priority chain preserved:
//   1. GPT Creative Director free-text override (gpt_creative_director)
//   2. Knowledge Graph query result (knowledge_graph)  ← this engine's output
//   3. Legacy hero-decision-engine fallback (hero_decision_engine)
//   4. Scene Planner knowledge bank (knowledge_bank)

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { HeroType, PipelineContext, KnowledgeTrace } from "../types";

export interface HeroGeneratorInput extends PipelineContext {
  /** Archetype ID selected by Archetype Selector. */
  archetypeId:    string;
  /** Primary experience type from Experience Engine. */
  primary:        string;
  /** Resolved campaign type string (e.g. "date_night", "product_showcase"). */
  campaignType:   string;
  /** Optional hint from Creative Brain hero-decision-engine (legacy bridge). */
  heroTypeHint?:  HeroType;
}

export type HeroSource =
  | "gpt_creative_director" // GPT free-text override — always wins if present
  | "knowledge_graph"       // HeroMomentKnowledgeNode from this engine
  | "hero_decision_engine"  // Legacy Phase 8 HERO_SUBJECTS fallback
  | "knowledge_bank";       // Scene Planner KB — last resort

export interface HeroGeneratorOutput {
  /** The subject text to place in the HERO block of the prompt. */
  subject:    string;
  heroType:   HeroType;
  /** Matches HeroMomentKnowledgeNode.id if source is "knowledge_graph". */
  momentId:   string;
  source:     HeroSource;
  reasoning:  string;
  trace:      KnowledgeTrace;
}

export type HeroGeneratorRunner = (
  input: HeroGeneratorInput,
  store: KnowledgeStore,
) => HeroGeneratorOutput;
