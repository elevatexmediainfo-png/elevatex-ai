import { resolveProviderCredentials } from "../credentials";
import { MockVoiceProvider } from "./mock.provider";
import { ElevenLabsVoiceProvider } from "./elevenlabs.provider";
import { EdgeTtsVoiceProvider } from "./edge-tts.provider";
import type { VoiceProvider } from "./types";

export * from "./types";

export const VOICE_PROVIDER_IDS = ["mock", "elevenlabs", "edge_tts"] as const;
export type VoiceProviderId = (typeof VOICE_PROVIDER_IDS)[number];

// The only place that maps a provider id to a concrete class. The
// Generation Engine (lib/generation/voice.ts) reads the ProviderConfig
// table (lib/providers/credentials.ts) and instantiates each enabled id in
// priority order to build a request's failover chain.
export async function instantiateVoiceProvider(id: VoiceProviderId): Promise<VoiceProvider> {
  switch (id) {
    case "elevenlabs":
      return new ElevenLabsVoiceProvider(await resolveProviderCredentials("VOICE", "elevenlabs"));
    case "edge_tts":
      // No credentials to resolve — see edge-tts.provider.ts's own comment
      // for why this adapter takes no config at all.
      return new EdgeTtsVoiceProvider();
    case "mock":
    default:
      return new MockVoiceProvider();
  }
}
