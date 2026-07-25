// AILLMProvider — the interface every AI OS LLM adapter must implement.
// Concrete implementations: OpenAIAILLMProvider (openai.ts).
// Factory (factory.ts) selects which to return at runtime based on admin config.
// No AI OS module should import a concrete adapter directly — always use the engine.

import type { AILLMHealth, AILLMRequest, AILLMResponse, AILLMVisionRequest } from "./types";

export interface AILLMProvider {
  /** Unique identifier matching the ProviderConfig.providerId value. */
  readonly providerId: string;

  /** Generate free-form text. Uses taskType to select system prompt and cache policy. */
  generateText(req: AILLMRequest): Promise<AILLMResponse>;

  /** Generate and parse structured JSON. Enables the vendor's JSON mode. */
  generateJSON<T>(req: AILLMRequest): Promise<T>;

  /** Analyze an image URL alongside a text prompt (vision). Never cached. */
  analyzeImage(req: AILLMVisionRequest): Promise<AILLMResponse>;

  /** Ping the provider with a minimal prompt and return health + latency. */
  healthCheck(): Promise<AILLMHealth>;
}
