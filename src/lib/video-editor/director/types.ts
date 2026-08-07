import type { ReasoningPlanRequest, ReasoningZoomItem } from "@/lib/providers/reasoning";
import type { AIBroll, AICaption, AIMusic, AISceneRemoval, AISfx, AISticker, AIStoryPlan, AITransitionPlan, AiQualityScoresV2 } from "@/lib/validations/ai-timeline";

// AI Video Director (2026-08-07) — the multi-agent pipeline's shared
// context object, threaded through director/orchestrator.ts. A single
// growing context (not the src/lib/creative/ pipeline's explicit named-
// arg chaining) — chosen because later agents need an INCREASING
// superset of earlier outputs (Audio needs Story+Captions+Visuals; the
// Quality Reviewer needs everything), and the quality-review loop must be
// able to re-invoke an arbitrary earlier agent and cascade to everything
// downstream of it (see DOWNSTREAM_OF in quality-review.ts) — a named-arg
// chain can't express "regenerate stage 3, keep 1/2/4 wiring intact"
// without a much larger parameter surface.

// Agent 1/2 — Video Analysis, Speech Analysis. NOT new LLM calls, purely
// reframings of the already-existing analyzeVideo()/transcribeAudio()+
// proposeSceneRemovals() stages ai-edit-jobs.ts already runs before
// PLANNING_TIMELINE. Type aliases only, documenting the reframing.
export type VideoAnalysisOutput = ReasoningPlanRequest["videoAnalysis"];

export interface SpeechAnalysisOutput {
  words: ReasoningPlanRequest["words"];
  sceneRemoval: AISceneRemoval[];
  survivingSegmentCount: number;
  sourceDurationMs: number;
}

export type DirectorAgentId = "story" | "captions" | "visuals" | "audio" | "review";

export interface DirectorJobMeta {
  userId: string;
  stylePreset?: string;
  brollDensity?: "MINIMAL" | "BALANCED" | "HEAVY";
  brollStockOnly?: boolean;
  referenceScript?: string;
  repairMaxAttempts: number;
  // Editing-density calibration (2026-08-08) — see
  // ReasoningPlanRequest.densityGuidance's own doc comment
  // (providers/reasoning/types.ts). Computed once by ai-edit-jobs.ts
  // before branching into either pipeline, so both get the same
  // this-video-specific rhythm calibration.
  densityGuidance?: string;
}

// Visual-variety dedup ledger (variety-ledger.ts, step 5) — tracked here
// so it survives across quality-loop iterations within one job.
export interface VarietyLedger {
  zoomStyles: string[];
  transitionTypes: string[];
  stickerQueries: string[];
  captionAnimations: string[];
  sfxQueries: string[];
  brollStyles: string[];
}
// Construction/mutation/scoring lives in variety-ledger.ts (createEmptyVarietyLedger et al.) — this is the shape only.

export interface DirectorContext {
  videoAnalysis: VideoAnalysisOutput;
  speech: SpeechAnalysisOutput;
  jobMeta: DirectorJobMeta;

  // Which of the 7 legacy TIMELINE_PLANNING_MODULES the job actually
  // selected — an agent whose ENTIRE output is out of scope short-
  // circuits to a no-op passthrough, same cost discipline the legacy
  // single-call path already has via wantsModule().
  wantsModule: (m: "captions" | "zoom" | "broll" | "stickers" | "music" | "sfx" | "transitions") => boolean;

  story?: AIStoryPlan;
  captions: AICaption[];
  zoom: ReasoningZoomItem[];
  broll: AIBroll[];
  stickers: AISticker[];
  transitions: AITransitionPlan[];
  music?: AIMusic;
  sfx: AISfx[];

  varietyLedger: VarietyLedger;

  // Real per-call vendor cost, summed across every agent call made so
  // far — the SAME costUsd numbers runGeneration() already computes per
  // call (see generation/reasoning.ts's new operation-tagged wrappers),
  // never re-estimated here.
  reasoningCostUsd: number;
  warnings: string[];
}

export interface DirectorIterationEntry {
  iteration: number;
  agentsInvoked: DirectorAgentId[];
  scores: AiQualityScoresV2;
  timestamp: string;
}

export interface DirectorPipelineResult {
  captions: AICaption[];
  zoom: ReasoningZoomItem[];
  broll: AIBroll[];
  stickers: AISticker[];
  transitions: AITransitionPlan[];
  music?: AIMusic;
  sfx: AISfx[];
  story: AIStoryPlan;
  scores: AiQualityScoresV2;
  reasoningCostUsd: number;
  warnings: string[];
  iterationHistory: DirectorIterationEntry[];
}
