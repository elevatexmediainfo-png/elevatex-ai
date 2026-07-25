import type {
  CreativeRequest,
  UserUnderstanding,
  AssetIntelligence,
  BrandContext,
  BrandKitIntelligence,
  LogoIntelligence,
} from "../types";
import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "../creative-director/types";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import type { VisualLayoutPlan } from "../visual-layout/types";
import type { TypographyPlan, CopywritingPlan } from "../typography/types";
import type { CommercialAssetPlan } from "../commercial-assets/types";
import type { CommercialCompositionPlan } from "../commercial-composition/types";
import type { CommercialCopy } from "../copy-intelligence/types";
import type { CommercialTypographyPlan } from "../typography-intelligence/types";
import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { CommercialReview }     from "../commercial-review/types";
import type { RetryExecutionPlan }   from "../retry-orchestrator/types";

// Phase 9 — Universal Campaign Blueprint types.
// The UniversalCampaignBlueprint is the SINGLE SOURCE OF TRUTH for the
// entire AI Operating System. Every downstream module (Prompt Composer,
// Image Generator, Video Engine, AI Editor) must receive ONLY this object.
//
// STRICT RULES:
//   ✗ Never modified by downstream modules — treat as immutable
//   ✗ Never used to generate prompts directly (that's the Prompt Composer's job)
//   ✗ Never passed to providers directly
//   ✓ Only consumed by downstream intelligence engines

// ─────────────────────────────────────────────────────────────────────────────
// 1. Project Metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectMetadata {
  /** Optional external project identifier (from session, DB record, etc.). */
  projectId?: string;
  /** Unique identifier for this specific Blueprint instance. */
  blueprintId: string;
  /** ISO timestamp when this Blueprint was assembled. */
  createdAt: string;
  /** Semver of the AI OS module set that produced this Blueprint. */
  aiOsVersion: string;
  /** Semver of the Blueprint schema itself — consumers check this to ensure compatibility. */
  schemaVersion: string;
  /** Semver of the knowledge banks (industry data, font personalities, etc.). */
  knowledgeVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. User Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface UserIntelligenceSection {
  /** The original CreativeRequest that initiated this pipeline run. */
  request: CreativeRequest;
  /** The full 25-field structured understanding from Phase 2. */
  understanding: UserUnderstanding;
  /** The raw idea text — preserved for reference and future embedding. */
  rawIdea: string;
  /** The detected content language. */
  detectedLanguage: "EN" | "HI" | "AUTO";
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Brand Intelligence (consolidated from AssetIntelligence)
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandIntelligence {
  /** Thin BrandContext for backward compat with Creative Brain/Director. */
  context?: BrandContext;
  /** Phase 3 rich Brand Kit Intelligence (when brand kit was found in DB). */
  kit?: BrandKitIntelligence;
  /** Phase 3 Logo Intelligence (when logo was uploaded and analyzed). */
  logo?: LogoIntelligence;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Memory References
// Future-ready placeholder section. No content today; slots established
// so Phase 10+ can populate memory without changing the Blueprint schema.
// ─────────────────────────────────────────────────────────────────────────────

export interface MemoryReferences {
  /** The current project's ID for history tracking. */
  currentProjectId?: string;
  /** IDs of past Blueprint versions for this project (enables regeneration comparison). */
  pastVersionIds: string[];
  /** Future: embedding vectors for semantic search and similarity. */
  readonly _futureEmbeddings: null;
  /** Future: learned user preferences and feedback signals. */
  readonly _futureLearning: null;
  /** Future: cross-project brand consistency vectors. */
  readonly _futureBrandMemory: null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Quality Metadata
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleConfidences {
  userIntelligence: number;   // 0-100
  assetIntelligence: number;  // 0-100
  strategy: number;           // 0-100 (from CreativeStrategy.confidenceScore)
  campaign: number;           // 0-100 (from CampaignPlan.confidenceScore)
  layout: number;             // 0-100 (from VisualLayoutPlan.confidenceScore)
  typography: number;         // 0-100 (from TypographyPlan.confidenceScore)
}

export interface QualityMetadata {
  /** Weighted 0–100 average across all module confidence scores. */
  overallConfidence: number;
  /** Per-module confidence breakdown. */
  moduleConfidences: ModuleConfidences;
  /** All "unknown" fields aggregated across every module. */
  unknownFields: string[];
  /** Non-fatal issues detected during assembly (missing brand kit, low confidence, etc.). */
  warnings: string[];
  /** The structural validity of the Blueprint. */
  validationStatus: "valid" | "valid_with_warnings" | "incomplete";
  /** 0–100 operational readiness for downstream generation.
   *  100 = all critical fields known; below 40 = generation likely to be generic. */
  readinessScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// UniversalCampaignBlueprint — the single source of truth
// ─────────────────────────────────────────────────────────────────────────────

export interface UniversalCampaignBlueprint {
  /** Structural metadata: IDs, timestamps, schema version. */
  readonly meta: Readonly<ProjectMetadata>;

  /** User intelligence: what the user wants, what language, what intent. */
  readonly userIntelligence: Readonly<UserIntelligenceSection>;

  /** All uploaded asset intelligence: reference image, brand context, logo. */
  readonly assetIntelligence: Readonly<AssetIntelligence>;

  /** Brand intelligence consolidated from assetIntelligence. */
  readonly brand: Readonly<BrandIntelligence>;

  /** The full Creative Strategy (8 domains, 50+ fields) from Phase 4. */
  readonly strategy: Readonly<CreativeStrategy>;

  /** The complete Campaign Plan (9 domains, 90 fields) from Phase 5. */
  readonly campaign: Readonly<CampaignPlan>;

  /** The Visual Layout Plan (8 domains, 82 fields) from Phase 6. */
  readonly layout: Readonly<VisualLayoutPlan>;

  /** The Typography Plan (8 domains, 64 fields) from Phase 8. */
  readonly typography: Readonly<TypographyPlan>;

  /** Quality metadata: confidence, warnings, validation, readiness. */
  readonly quality: Readonly<QualityMetadata>;

  /** Memory references: project history + future embedding slots. */
  readonly memory: Readonly<MemoryReferences>;

  // ── Future extension slots ─────────────────────────────────────────────────
  // These optional fields are typed as their placeholder interfaces now so
  // they can be populated in future phases without a breaking schema change.
  /** Phase 5.1 — GPT Creative Director output (populated when GPT mode succeeded). */
  readonly gptDirection?: Readonly<GPTCampaignDirection>;
  /** Phase 7 — CopywritingPlan (not yet built, placeholder type exists). */
  readonly copywriting?: Readonly<CopywritingPlan>;
  /** Phase 8.7A — Commercial Asset Plan: which overlays should exist and in what priority. */
  readonly commercialAssets?: Readonly<CommercialAssetPlan>;
  /** Phase 8.7C — Commercial Composition Plan: WHERE every overlay belongs on the canvas. */
  readonly commercialComposition?: Readonly<CommercialCompositionPlan>;
  /** Phase 8.8A — Commercial Copy: headline, CTA, benefits, social proof, offer, disclaimer. */
  readonly commercialCopy?: Readonly<CommercialCopy>;
  /** Phase 8.9 — Commercial Typography Plan: per-element visual behaviour (size, weight, alignment, contrast). */
  readonly commercialTypography?: Readonly<CommercialTypographyPlan>;
  /** Phase 9.0 — Commercial Render Plan: absolute pixel coordinates for all overlay elements. */
  readonly renderPlan?: Readonly<CommercialRenderPlan>;
  /** Phase 9.1 — Commercial Quality Review: evaluation scores, issues, and retry recommendation. */
  readonly commercialReview?: Readonly<CommercialReview>;
  /** Phase 9.2 — Smart Retry Execution Plan: which module to retry, how many times, and why. */
  readonly retryPlan?: Readonly<RetryExecutionPlan>;
  /** Future Phase — Video Direction Plan. */
  readonly video?: undefined;
  /** Future Phase — Audio Direction Plan. */
  readonly audio?: undefined;
  /** Future Phase — AI Video Editor Plan. */
  readonly editor?: undefined;
  /** Future Phase — Talking Head Direction Plan. */
  readonly talkingHead?: undefined;
  /** Future Phase — 3D Spatial Direction Plan. */
  readonly spatial3d?: undefined;
}
