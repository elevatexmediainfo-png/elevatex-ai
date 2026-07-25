import type { GenerationProvider } from "@/lib/generation/types";

export interface VoiceGenerateRequest {
  script: string;
  contentLanguage: "EN" | "HI" | "HINGLISH";
  /** An id from the admin-configured AVAILABLE_VOICES list (Milestone 8 Scene Editor voice picker). Real adapters map it to a vendor voice id; adapters that don't support voice selection ignore it. */
  voiceId?: string;
}

export interface VoiceGenerateResult {
  audioUrl: string;
  durationSeconds: number;
  providerRef?: string;
  usage?: { characters?: number };
}

// generateVoiceover() (lib/generation/voice.ts) returns this PLUS a
// `providerId` — attached generically by runGeneration()'s own success path
// (lib/generation/engine.ts), not by any voice-specific code — same
// mechanism/reasoning as VideoRenderResultWithProvider above. Compare
// against MOCK_PROVIDER_ID (lib/generation/types.ts) before persisting a
// "successful" voiceover: the failover chain can silently resolve to the
// mock placeholder (a canned T-Rex-roar sample), and a caller with no way
// to distinguish that from a real vendor result would silently ship it as
// the user's real narration (the real 2026-07-23 audit finding this type
// exists to close, mirroring VIDEO's own pre-existing guard).
export type VoiceGenerateResultWithProvider = VoiceGenerateResult & { providerId: string; costUsd?: number };

export interface VoiceProvider extends GenerationProvider {
  generate(req: VoiceGenerateRequest): Promise<VoiceGenerateResult>;
}
