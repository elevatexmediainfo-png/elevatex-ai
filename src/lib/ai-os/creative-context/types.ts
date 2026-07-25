import type { CreativeRequest, UserUnderstanding, AssetIntelligence } from "../types";
import type { CampaignBlueprint } from "../campaign-blueprint";

// Phase 3.5 — Creative Context Layer.
// CreativeContext is the single aggregated object that flows from the AI OS
// layer into the creative pipeline. It replaces the scattered individual
// inputs (rawIdea, kind, referenceAnalysis, brandKit) that the route handler
// was previously assembling and passing separately to each pipeline step.
//
// Nothing in this file generates prompts, campaigns, layouts, or images.
// It is pure data aggregation — a typed container, not business logic.

/** Minimal session-level context extracted from the authenticated user. */
export interface SessionContext {
  userId: string;
  /** Detected or user-preferred content language — carried forward from the
   *  request for downstream pipeline steps. */
  preferredLanguage?: string;
}

/** Optional project-level context for tracking, versioning, and future
 *  regeneration flows. Populated when a CreativeProject already exists. */
export interface ProjectContext {
  projectId?: string;
  projectTitle?: string;
  /** ISO timestamp of the last successful generation for this project. */
  lastGeneratedAt?: string;
}

/** Placeholder for future persistent user-preference and interaction memory.
 *  Nothing reads or writes this yet — the field establishes the slot in the
 *  contract so Phase 4+ can populate it without a breaking type change. */
export interface MemoryContext {
  /** Explicit marker that this is a placeholder — prevents accidental use. */
  readonly _placeholder: true;
}

/** The single aggregated context object produced by the Creative Context layer.
 *  Every module in the creative pipeline receives this instead of individual
 *  parameters — one object in, structured intelligence out. */
export interface CreativeContext {
  // ── Core inputs ────────────────────────────────────────────────────────
  /** The validated, normalized incoming request. */
  request: CreativeRequest;
  /** Phase 2: 25-field business intelligence extracted from the raw idea text. */
  userUnderstanding: UserUnderstanding;
  /** Phase 3: structured intelligence about every uploaded asset. */
  assetIntelligence: AssetIntelligence;

  // ── Runtime context ────────────────────────────────────────────────────
  sessionContext: SessionContext;
  /** Optional — present when a project record already exists (e.g. regeneration). */
  projectContext?: ProjectContext;

  // ── Future slots ──────────────────────────────────────────────────────
  /** Placeholder — future: user preferences, learned patterns, past feedback. */
  memoryContext?: MemoryContext;
  /** Placeholder — future: populated by Phase 4+ Creative Brain output. */
  campaignBlueprint?: CampaignBlueprint;

  /** ISO timestamp when this context was assembled (used for telemetry). */
  createdAt: string;
}
