// Phase 10.4.0 — Experience Engine interface contract.
// Replaces inline experience logic in creative-brain/experience-engine.ts.
//
// Migration plan (Phase 10.4.0C):
//   INTENT_TO_PRIMARY map     →  ExperienceMapKnowledgeNode (triggerType: "intent")
//   GOAL_TO_PRIMARY map       →  ExperienceMapKnowledgeNode (triggerType: "goal")
//   INDUSTRY_SECONDARY map    →  ExperienceMapKnowledgeNode (triggerType: "industry_secondary")
//   EMOTIONAL_CORE map        →  EmotionKnowledgeNode entries
//   VISUAL_IMPLICATION map    →  PsychologyKnowledgeNode entries
//   buildExperienceProfile()  →  engine run() function, queries store by kind "experience_map"
//
// After migration: creative-brain/experience-engine.ts delegates to run() here.
// Knowledge store query: store.query({ kind: "experience_map", anyTags: [intent, campaignGoal] })

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { ExperienceType, PipelineContext, KnowledgeTrace } from "../types";

export interface ExperienceEngineInput extends PipelineContext {
  /** Intent signal from Creative Brain (e.g. "build_trust", "drive_sales"). */
  intent:          string;
  /** Urgency level from Communication Intelligence. */
  urgency:         string;
  /** Eugene Schwartz awareness level from Audience Intelligence. */
  awarenessLevel:  string;
  /** Campaign type if known — used for secondary experience selection. */
  campaignType?:   string;
}

export interface ExperienceEngineOutput {
  primary:           ExperienceType;
  secondary:         ExperienceType | "none";
  intensity:         "high" | "medium" | "low";
  /** Short phrase describing the emotional core of this experience. */
  emotionalCore:     string;
  /** How this experience should be made physically visible in the frame. */
  visualImplication: string;
  trace:             KnowledgeTrace;
}

/**
 * Pure function contract. Given signals + a populated store, returns a
 * deterministic experience profile. Inject a mock store in tests.
 */
export type ExperienceEngineRunner = (
  input: ExperienceEngineInput,
  store: KnowledgeStore,
) => ExperienceEngineOutput;
