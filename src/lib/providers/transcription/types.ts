import type { GenerationProvider } from "@/lib/generation/types";

export interface TranscriptionRequest {
  audioUrl: string;
  /** ISO 639-1 hint (e.g. "en") — adapters that support auto-detect may ignore this and return their own detected language instead. */
  language?: string;
}

export interface TranscriptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptionSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  words: TranscriptionWord[];
  language: string;
  durationSeconds: number;
  providerRef?: string;
  usage?: { seconds?: number };
}

export interface TranscriptionProvider extends GenerationProvider {
  transcribe(req: TranscriptionRequest): Promise<TranscriptionResult>;
}

// transcribeAudio() (lib/generation/transcription.ts) returns this PLUS a
// `providerId` — attached generically by runGeneration()'s own success path
// (lib/generation/engine.ts), not by any transcription-specific code —
// identifying which provider actually served the result. Same shape/same
// reasoning as VideoRenderResultWithProvider (lib/providers/video/types.ts):
// compare against MOCK_PROVIDER_ID before trusting a transcript as real —
// the failover chain can silently resolve to the mock placeholder, which is
// exactly the gap that produced three separate real incidents before this
// type existed.
// Phase 12 Module 10 — costUsd is attached by the Generation Engine itself
// (runGeneration, generation/engine.ts), not by any TranscriptionProvider
// adapter — real per-call vendor cost, for the AI Auto-Editor cost preview.
export type TranscriptionResultWithProvider = TranscriptionResult & { providerId: string; costUsd?: number };
