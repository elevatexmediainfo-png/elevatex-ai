import { resolveProviderCredentials } from "../credentials";
import { MockImageProvider } from "./mock.provider";
import { OpenAIImagesProvider } from "./openai-images.provider";
import { FluxImageProvider } from "./flux.provider";
import { IdeogramImageProvider } from "./ideogram.provider";
import { GeminiImagesProvider } from "./gemini-images.provider";
import { ImagenProvider } from "./imagen.provider";
import type { ImageProvider } from "./types";

export * from "./types";

export const IMAGE_PROVIDER_IDS = ["mock", "openai_images", "flux", "ideogram", "gemini_images", "imagen"] as const;
export type ImageProviderId = (typeof IMAGE_PROVIDER_IDS)[number];

// The only place that maps a provider id to a concrete class. The
// Generation Engine (lib/generation/image.ts) reads the ProviderConfig
// table (lib/providers/credentials.ts) and instantiates each enabled id in
// priority order to build a request's failover chain.
export async function instantiateImageProvider(id: ImageProviderId): Promise<ImageProvider> {
  switch (id) {
    case "openai_images":
      return new OpenAIImagesProvider(await resolveProviderCredentials("IMAGE", "openai_images"));
    case "flux":
      return new FluxImageProvider(await resolveProviderCredentials("IMAGE", "flux"));
    case "ideogram":
      return new IdeogramImageProvider(await resolveProviderCredentials("IMAGE", "ideogram"));
    case "gemini_images":
      return new GeminiImagesProvider(await resolveProviderCredentials("IMAGE", "gemini_images"));
    case "imagen":
      return new ImagenProvider(await resolveProviderCredentials("IMAGE", "imagen"));
    case "mock":
    default:
      return new MockImageProvider();
  }
}
