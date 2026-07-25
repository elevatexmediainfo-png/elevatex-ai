// Phase 10.4.0 — Universal Psychology knowledge scaffold.
// Psychological triggers and experience maps — industry-agnostic.
// Population: Phase 10.4.1.
//
// Two node kinds live here:
//
// 1. PsychologyKnowledgeNode — Cialdini + behavioural triggers
//    Examples: social_proof, authority, scarcity, reciprocity, liking, unity
//
// 2. ExperienceMapKnowledgeNode — intent/goal → ExperienceType mappings
//    Migration target for INTENT_TO_PRIMARY + GOAL_TO_PRIMARY + INDUSTRY_SECONDARY
//    maps currently hardcoded in creative-brain/experience-engine.ts

import type { PsychologyKnowledgeNode, ExperienceMapKnowledgeNode } from "../../node";

/** Universal psychology trigger nodes. Populated in Phase 10.4.1. */
export const UNIVERSAL_PSYCHOLOGY: PsychologyKnowledgeNode[] = [];

/** Experience map nodes — migrated from experience-engine.ts in Phase 10.4.0C. */
export const EXPERIENCE_MAPS: ExperienceMapKnowledgeNode[] = [];
