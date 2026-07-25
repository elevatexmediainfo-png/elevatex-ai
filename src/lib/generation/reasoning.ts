import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateReasoningProvider } from "@/lib/providers/reasoning";
import type {
  ReasoningPlanRequest,
  ReasoningProviderId,
  ReasoningPlanResultWithProvider,
  ReasoningReeditRequest,
  ReasoningReeditResultWithProvider,
} from "@/lib/providers/reasoning";
import { runGeneration } from "./engine";
import type { GenerationContext } from "./types";

export async function planTimeline(
  req: ReasoningPlanRequest,
  context?: GenerationContext
): Promise<ReasoningPlanResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));

  return runGeneration({
    category: "REASONING",
    operation: "plan_timeline",
    providers,
    invoke: (provider, signal) => provider.plan(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}

// Phase 12 Module 9 — same REASONING category/provider priority chain as
// planTimeline() above, a genuinely different call (provider.reEdit(),
// not .plan()) for the SAME underlying capability the app already pays
// for and configures once in Admin → AI Providers.
export async function planReedit(req: ReasoningReeditRequest, context?: GenerationContext): Promise<ReasoningReeditResultWithProvider> {
  const priority = await listEnabledProviderConfigs("REASONING");
  const providers = await Promise.all(priority.map((id) => instantiateReasoningProvider(id as ReasoningProviderId)));

  return runGeneration({
    category: "REASONING",
    operation: "reedit_clip",
    providers,
    invoke: (provider, signal) => provider.reEdit(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}
