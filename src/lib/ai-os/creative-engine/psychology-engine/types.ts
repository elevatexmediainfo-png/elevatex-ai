// Phase 10.4.0 — Psychology Engine interface contract.
// NEW engine — no direct predecessor in Phase 8.
// Derives psychological conversion mechanisms from the experience profile.
//
// Knowledge consumed: PsychologyKnowledgeNode from
//   creative-knowledge/universal/psychology/
//
// Purpose: bridges ExperienceType → concrete Cialdini/behavioural trigger →
// visual expression. Currently this logic is hardcoded inside Creative Brain.
// Moving it here makes it knowledge-driven and independently expandable.

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { ExperienceType, PipelineContext, KnowledgeTrace } from "../types";

export interface PsychologyEngineInput extends PipelineContext {
  primary:        ExperienceType;
  secondary:      ExperienceType | "none";
  urgency:        string;
  audience:       string;
  campaignType?:  string;
}

export interface PsychologyTrigger {
  /** The psychological mechanism name (e.g. "social_proof", "scarcity", "authority"). */
  mechanism:          string;
  /** How this trigger should be made physically visible in the frame. */
  visualExpression:   string;
  /** The conversion outcome this trigger is designed to produce. */
  conversionFunction: string;
  confidence:         "high" | "medium" | "low";
}

export interface PsychologyEngineOutput {
  primaryTrigger:     PsychologyTrigger;
  secondaryTrigger?:  PsychologyTrigger;
  /** Describes the emotional journey the viewer takes through the creative. */
  emotionalArc:       string;
  /** What the audience wants and how this creative speaks to it. */
  audienceMotivation: string;
  trace:              KnowledgeTrace;
}

export type PsychologyEngineRunner = (
  input: PsychologyEngineInput,
  store: KnowledgeStore,
) => PsychologyEngineOutput;
