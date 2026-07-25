import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateVideoUnderstandingProvider } from "@/lib/providers/video-understanding";
import type {
  VideoUnderstandingRequest,
  VideoUnderstandingProviderId,
  VideoUnderstandingResultWithProvider,
} from "@/lib/providers/video-understanding";
import { runGeneration } from "./engine";
import type { GenerationContext } from "./types";

export async function analyzeVideo(
  req: VideoUnderstandingRequest,
  context?: GenerationContext
): Promise<VideoUnderstandingResultWithProvider> {
  const priority = await listEnabledProviderConfigs("VIDEO_UNDERSTANDING");
  const providers = await Promise.all(
    priority.map((id) => instantiateVideoUnderstandingProvider(id as VideoUnderstandingProviderId))
  );

  return runGeneration({
    category: "VIDEO_UNDERSTANDING",
    operation: "analyze",
    providers,
    invoke: (provider, signal) => provider.analyze(req, signal),
    getUsage: (result) => result.usage,
    context,
  });
}
