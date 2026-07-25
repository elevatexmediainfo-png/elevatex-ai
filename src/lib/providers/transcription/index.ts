import { resolveProviderCredentials } from "../credentials";
import { AssemblyAITranscriptionProvider } from "./assemblyai.provider";
import { MockTranscriptionProvider } from "./mock.provider";
import { OpenAIWhisperTranscriptionProvider } from "./openai-whisper.provider";
import type { TranscriptionProvider } from "./types";

export * from "./types";

export const TRANSCRIPTION_PROVIDER_IDS = ["mock", "openai_whisper", "assemblyai"] as const;
export type TranscriptionProviderId = (typeof TRANSCRIPTION_PROVIDER_IDS)[number];

// The only place that maps a provider id to a concrete class. The
// Generation Engine (lib/generation/transcription.ts) reads the
// ProviderConfig table (lib/providers/credentials.ts) and instantiates each
// enabled id in priority order to build a request's failover chain.
export async function instantiateTranscriptionProvider(id: TranscriptionProviderId): Promise<TranscriptionProvider> {
  switch (id) {
    case "assemblyai":
      return new AssemblyAITranscriptionProvider(await resolveProviderCredentials("TRANSCRIPTION", "assemblyai"));
    case "openai_whisper":
      return new OpenAIWhisperTranscriptionProvider(await resolveProviderCredentials("TRANSCRIPTION", "openai_whisper"));
    case "mock":
    default:
      return new MockTranscriptionProvider();
  }
}
