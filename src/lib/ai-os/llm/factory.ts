// LLMFactory — selects the active AILLMProvider at runtime.
// Provider selection at the AI OS level is a thin hint: each adapter delegates
// to generateScript() (lib/generation/llm.ts), which reads the admin-configured
// ProviderConfig table and handles failover automatically. The factory's job is
// simply to instantiate the right AI OS adapter class — not to duplicate the
// generation engine's provider-resolution logic.

import { OpenAIAILLMProvider } from "./openai";
import type { AILLMProvider } from "./provider";

type SupportedProviderId = "openai";

const _instances = new Map<SupportedProviderId, AILLMProvider>();

function getInstance(id: SupportedProviderId): AILLMProvider {
  let inst = _instances.get(id);
  if (!inst) {
    // Only OpenAI is wired in the AI OS layer today. All calls route through
    // generateScript(), so if the admin disables openai, the generation engine
    // falls back to the next enabled provider automatically.
    inst = new OpenAIAILLMProvider();
    _instances.set(id, inst);
  }
  return inst;
}

export class LLMFactory {
  /** Return the default AI OS LLM provider (openai, with generation-engine failover). */
  static getDefault(): AILLMProvider {
    return getInstance("openai");
  }

  /** Return a provider by its ProviderConfig.providerId string. */
  static getProvider(providerId: string): AILLMProvider {
    // Future: add "gemini" case here with a GeminiAILLMProvider implementation.
    // All IDs currently resolve to openai; generateScript handles the actual routing.
    switch (providerId) {
      case "openai":
      default:
        return getInstance("openai");
    }
  }

  /** Flush cached instances (call after admin changes provider config in tests). */
  static invalidate(): void {
    _instances.clear();
  }
}
