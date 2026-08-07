import type { GenerationProvider } from "@/lib/generation/types";

// Phase 12 Module 3 (AI Auto-Editor) — Gemini "watching" the uploaded
// video+audio together. Distinct contract from TranscriptionProvider
// (words-only, audio-only): this returns timestamped VISUAL/combined
// analysis a transcript alone can never produce — emphasis moments,
// emotion beats, on-screen visual context, gestures, and (the part
// Module 3 actually consumes) flagged segments a human editor would cut:
// visible bad takes/restarts, duplicate takes, and quality issues.

export interface VideoUnderstandingRequest {
  videoUrl: string;
}

export interface TimedMoment {
  startMs: number;
  endMs: number;
  description: string;
}

export interface EmotionBeat extends TimedMoment {
  emotion: string;
}

// Matches AISceneRemovalReason's video-derived subset exactly
// (lib/validations/ai-timeline.ts) — "silence"/"filler_word"/
// "duplicate_phrase" are transcript-derived (Module 2 / the 2026-08-07
// quality upgrade) and never produced by this provider. "camera_adjustment"
// (2026-08-07, "cinematic editing") — the camera visibly being repositioned/
// refocused mid-shot, not part of the final cut. "dead_reaction" — a
// visible pause with no meaningful expression/reaction, distinct from a
// "quality_issue" (which is about framing/lighting/blur, not content).
export const VIDEO_FLAG_REASONS = ["bad_take", "duplicate_take", "quality_issue", "camera_adjustment", "dead_reaction"] as const;
export type VideoFlagReason = (typeof VIDEO_FLAG_REASONS)[number];

export interface VideoFlaggedSegment {
  startMs: number;
  endMs: number;
  reason: VideoFlagReason;
  description: string;
}

export interface VideoUnderstandingResult {
  emphasisMoments: TimedMoment[];
  emotionBeats: EmotionBeat[];
  visualContext: TimedMoment[];
  gestures: TimedMoment[];
  flaggedSegments: VideoFlaggedSegment[];
  durationSeconds: number;
  providerRef?: string;
  // Phase 12 Module 10 — tokens, not seconds: Gemini bills this call by
  // prompt+response tokens (GENERATION_COST_RATES's "gemini" entry is
  // PER_1K_TOKENS, matching every other Gemini-billed category in this
  // app), so a seconds-shaped usage object here could never produce a
  // real cost regardless of the configured rate.
  usage?: { tokens?: number };
}

export interface VideoUnderstandingProvider extends GenerationProvider {
  analyze(req: VideoUnderstandingRequest, signal?: AbortSignal): Promise<VideoUnderstandingResult>;
}

// Phase 12 Module 10 — costUsd is attached by the Generation Engine itself
// (runGeneration, generation/engine.ts), not by this provider's own
// analyze() — real per-call vendor cost, for the AI Auto-Editor cost preview.
export type VideoUnderstandingResultWithProvider = VideoUnderstandingResult & { providerId: string; costUsd?: number };
