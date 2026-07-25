// Phase 10.4 — Creative Memory schema types.
// Schema-only. No storage implementation in this phase.
//
// Defines the complete generation chain:
//   Input → Blueprint → Hero → Scene → Prompt → Output → Review → Feedback
//
// Integration with blueprint/types.ts:
//   The existing MemoryReferences._futureLearning slot (typed as null) is
//   the designated home for CreativeMemoryEntry references once Phase 10.4E
//   implements DB storage. Do not modify blueprint/types.ts in this phase.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MaterialTier } from "../../prompt-spec/material-engine";
import type { ExtendedRouteSignals, RouteScore } from "../route-engine/types";
import type { DiversityMetadata } from "../diversity-metadata/types";
import type {
  ArchetypeId,
  HeroMomentId,
  SceneTypeId,
  CampaignGoal,
} from "../types";

// ── Sub-schemas ────────────────────────────────────────────────────────────

/** The raw creative request and all detected signals. */
export interface MemoryInput {
  rawIdea:      string;
  industry:     SceneIndustry;
  campaignGoal: CampaignGoal;
  luxuryTier:   MaterialTier;
  signals:      ExtendedRouteSignals;
}

/** The creative route and scoring decisions. */
export interface MemoryBlueprint {
  /** Phase 8.6 route ID — always set. */
  selectedRouteId: string;
  /** Archetype ID — empty until Phase 10.4B populates registry. */
  archetypeId:     ArchetypeId;
  /** Hero moment ID — populated from Phase 10.4I heroGraph. */
  heroMomentId:    HeroMomentId;
  /** Scene type ID — populated from Phase 10.4I heroGraph. */
  sceneTypeId:     SceneTypeId;
  /** Phase 10.4I — heroCategory for emotion-dimension similarity scoring. */
  emotionId?:      string;
  /** Phase 10.4I — sceneCategory for environment-dimension similarity scoring. */
  environmentId?:  string;
  score:           RouteScore;
}

/** The hero subject that was used in this generation. */
export interface MemoryHero {
  /** The actual subject text that appeared in the HERO block. */
  subject: string;
  /** Which pipeline generated this subject. */
  source:
    | "gpt_creative_director"
    | "hero_decision_engine"
    | "knowledge_bank"
    | "knowledge_graph";
}

/** The scene environment for this generation. */
export interface MemoryScene {
  environment:  string;
  lighting:     string;
  composition:  string;
}

/** The prompt that was sent to the image provider. */
export interface MemoryPrompt {
  finalPrompt:    string;
  providerTarget: string;
  /** Which named blocks were present (SCENE, HERO, CAMERA, SURFACE MATERIALS, etc.). */
  blocksPresent:  string[];
  /** Whether Phase 10.4A realism vocabulary was applied. */
  realismApplied: boolean;
  materialTier:   MaterialTier;
}

/** Metadata about the generated output asset. */
export interface MemoryOutputMetadata {
  generatedAt: Date;
  projectId?:  string;
  assetId?:    string;
  /** Diversity fingerprint for this generation (from computeFingerprint()). */
  fingerprint: string;
}

/**
 * Post-generation commercial review.
 * Populated from Phase 9.1 CommercialReview fields after generation.
 */
export interface MemoryCommercialReview {
  reviewedAt:  Date;
  isOnBrief:   boolean;
  heroScore?:  number; // 0–100
  sceneScore?: number; // 0–100
  notes?:      string;
}

/** User feedback signal collected after delivery. */
export interface MemoryUserFeedback {
  rating?:       1 | 2 | 3 | 4 | 5;
  regenerated:   boolean;
  feedbackText?: string;
  timestamp:     Date;
}

// ── Main entry ────────────────────────────────────────────────────────────────

/**
 * One complete creative memory entry — one per generation.
 * Future Phase 10.4E: persisted to the DB after generation completes.
 * Future Phase 10.4F: queried to supply HistorySignal to the Route Engine.
 */
export interface CreativeMemoryEntry {
  /** UUID generated at creation. */
  id:        string;
  userId:    string;
  timestamp: Date;
  input:     MemoryInput;
  blueprint: MemoryBlueprint;
  hero:      MemoryHero;
  scene:     MemoryScene;
  prompt:    MemoryPrompt;
  output:    MemoryOutputMetadata;
  diversity: DiversityMetadata;
  /** Set after Phase 9.1 commercial review runs. */
  review?:   MemoryCommercialReview;
  /** Set when user rates or triggers regeneration. */
  feedback?: MemoryUserFeedback;
}
