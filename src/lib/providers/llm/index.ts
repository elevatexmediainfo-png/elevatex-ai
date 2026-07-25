import { resolveProviderCredentials } from "../credentials";
import { MockLLMProvider } from "./mock.provider";
import { OpenAILLMProvider } from "./openai.provider";
import { GeminiLLMProvider } from "./gemini.provider";
import { SelfHostedLLMProvider } from "./self-hosted.provider";
import type { LLMProvider } from "./types";

export * from "./types";

export const LLM_PROVIDER_IDS = ["mock", "openai", "gemini", "self_hosted"] as const;
export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number];

// The only place that maps a provider id to a concrete class. The
// Generation Engine (lib/generation/llm.ts) reads the ProviderConfig table
// (lib/providers/credentials.ts) and instantiates each enabled id in
// priority order to build a request's failover chain — business logic
// never imports an adapter directly. self_hosted has no apiKey/apiSecret
// shape (it's a URL, see self-hosted.provider.ts) so it's excluded from the
// credential-resolution path.
export async function instantiateLLMProvider(id: LLMProviderId): Promise<LLMProvider> {
  switch (id) {
    case "openai":
      return new OpenAILLMProvider(await resolveProviderCredentials("LLM", "openai"));
    case "gemini":
      return new GeminiLLMProvider(await resolveProviderCredentials("LLM", "gemini"));
    case "self_hosted":
      return new SelfHostedLLMProvider();
    case "mock":
    default:
      return new MockLLMProvider();
  }
}
