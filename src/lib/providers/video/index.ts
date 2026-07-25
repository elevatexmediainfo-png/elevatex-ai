import { resolveProviderCredentials } from "../credentials";
import { MockVideoProvider } from "./mock.provider";
import { ReplicateVideoProvider } from "./replicate.provider";
import { VeoVideoProvider } from "./veo.provider";
import { KlingVideoProvider } from "./kling.provider";
import { HailuoVideoProvider } from "./hailuo.provider";
import { RunwayVideoProvider } from "./runway.provider";
import { SoraVideoProvider } from "./sora.provider";
import { SeedanceVideoProvider } from "./seedance.provider";
import type { VideoProvider } from "./types";

export * from "./types";

// veo/kling/hailuo/runway/sora/seedance2 are best-effort adapters (see
// their own files' doc comments) — they ship disabled by default
// (ProviderConfig.enabled) until an admin turns one on from the AI
// Providers panel.
export const VIDEO_PROVIDER_IDS = ["mock", "replicate", "veo", "kling", "hailuo", "runway", "sora", "seedance2"] as const;
export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number];

// The only place that maps a provider id to a concrete class. The
// Generation Engine (lib/generation/video.ts) reads the ProviderConfig
// table (lib/providers/credentials.ts) and instantiates each enabled id in
// priority order to build a request's failover chain. Adding a future
// provider needs exactly three things: a new adapter file, a case here, and
// an Admin AI Providers row — nothing else.
export async function instantiateVideoProvider(id: VideoProviderId): Promise<VideoProvider> {
  switch (id) {
    case "replicate":
      return new ReplicateVideoProvider(await resolveProviderCredentials("VIDEO", "replicate"));
    case "veo":
      return new VeoVideoProvider(await resolveProviderCredentials("VIDEO", "veo"));
    case "kling":
      return new KlingVideoProvider(await resolveProviderCredentials("VIDEO", "kling"));
    case "hailuo":
      return new HailuoVideoProvider(await resolveProviderCredentials("VIDEO", "hailuo"));
    case "runway":
      return new RunwayVideoProvider(await resolveProviderCredentials("VIDEO", "runway"));
    case "sora":
      return new SoraVideoProvider(await resolveProviderCredentials("VIDEO", "sora"));
    case "seedance2":
      return new SeedanceVideoProvider(await resolveProviderCredentials("VIDEO", "seedance2"));
    case "mock":
    default:
      return new MockVideoProvider();
  }
}
