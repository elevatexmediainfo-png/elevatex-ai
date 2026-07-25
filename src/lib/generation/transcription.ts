import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateTranscriptionProvider } from "@/lib/providers/transcription";
import type {
  TranscriptionRequest,
  TranscriptionProviderId,
  TranscriptionResultWithProvider,
} from "@/lib/providers/transcription";
import { runGeneration } from "./engine";
import type { GenerationContext } from "./types";

// Generation Engine entry point for speech-to-text — same failover/retry/
// timeout/cost-tracking/health-monitoring as LLM/Image/Voice/Video, for
// free, because the engine is generic over GenerationCategory.
export async function transcribeAudio(
  req: TranscriptionRequest,
  context?: GenerationContext
): Promise<TranscriptionResultWithProvider> {
  const priority = await listEnabledProviderConfigs("TRANSCRIPTION");
  const providers = await Promise.all(
    priority.map((id) => instantiateTranscriptionProvider(id as TranscriptionProviderId))
  );

  return runGeneration({
    category: "TRANSCRIPTION",
    operation: "transcribe",
    providers,
    invoke: (provider) => provider.transcribe(req),
    getUsage: (result) => result.usage,
    context,
  });
}
