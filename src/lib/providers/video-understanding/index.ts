import { resolveProviderCredentials } from "../credentials";
import { GeminiVideoUnderstandingProvider } from "./gemini.provider";
import { MockVideoUnderstandingProvider } from "./mock.provider";
import type { VideoUnderstandingProvider } from "./types";

export * from "./types";

export const VIDEO_UNDERSTANDING_PROVIDER_IDS = ["mock", "gemini"] as const;
export type VideoUnderstandingProviderId = (typeof VIDEO_UNDERSTANDING_PROVIDER_IDS)[number];

export async function instantiateVideoUnderstandingProvider(id: VideoUnderstandingProviderId): Promise<VideoUnderstandingProvider> {
  switch (id) {
    case "gemini":
      return new GeminiVideoUnderstandingProvider(await resolveProviderCredentials("VIDEO_UNDERSTANDING", "gemini"));
    case "mock":
    default:
      return new MockVideoUnderstandingProvider();
  }
}
