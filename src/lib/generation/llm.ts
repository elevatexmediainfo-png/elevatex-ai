import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateLLMProvider } from "@/lib/providers/llm";
import type { LLMGenerateRequest, LLMGenerateResult, LLMProviderId } from "@/lib/providers/llm";
import { reorderProvidersByPreference, runGeneration } from "./engine";
import type { GenerationContext } from "./types";

// Generation Engine entry point for LLM text generation — replaces direct
// getLLMProvider() calls. Reads the admin-configured priority order (the
// ProviderConfig table, lib/providers/credentials.ts) fresh on every call so
// an admin's reordering takes effect with no redeploy. `operation`
// distinguishes the initial script generation from Script Studio's
// rewrite/expand/shorten/translate/hook/cta calls (Milestone 8) in usage
// analytics — all of them are still the exact same LLM call shape.
export async function generateScript(
  req: LLMGenerateRequest,
  context?: GenerationContext,
  operation: string = "script",
  preferredProviderId?: string
): Promise<LLMGenerateResult> {
  const priority = await listEnabledProviderConfigs("LLM");
  const providers = await Promise.all(priority.map((id) => instantiateLLMProvider(id as LLMProviderId)));
  const ordered = reorderProvidersByPreference(providers, preferredProviderId);

  return runGeneration({
    category: "LLM",
    operation,
    providers: ordered,
    invoke: (provider) => provider.generate(req),
    getUsage: (result) => result.usage,
    context,
  });
}
