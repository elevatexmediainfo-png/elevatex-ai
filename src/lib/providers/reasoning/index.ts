import { resolveProviderCredentials } from "../credentials";
import { GPT5ReasoningProvider } from "./gpt5.provider";
import { MockReasoningProvider } from "./mock.provider";
import type { ReasoningProvider } from "./types";

export * from "./types";

export const REASONING_PROVIDER_IDS = ["mock", "gpt5"] as const;
export type ReasoningProviderId = (typeof REASONING_PROVIDER_IDS)[number];

export async function instantiateReasoningProvider(id: ReasoningProviderId): Promise<ReasoningProvider> {
  switch (id) {
    case "gpt5":
      return new GPT5ReasoningProvider(await resolveProviderCredentials("REASONING", "gpt5"));
    case "mock":
    default:
      return new MockReasoningProvider();
  }
}
