import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateTranscriptionProvider } from "@/lib/providers/transcription";
import type {
  TranscriptionRequest,
  TranscriptionProviderId,
  TranscriptionResultWithProvider,
} from "@/lib/providers/transcription";
import { runGeneration } from "./engine";
import type { GenerationContext } from "./types";

// Real, implemented TRANSCRIPTION adapters only. Deliberately NOT the same
// as TRANSCRIPTION_PROVIDER_IDS (which also lists "mock", never a real
// backing service) — this is the list of ids that actually have a working
// class behind them in lib/providers/transcription/index.ts's factory.
const IMPLEMENTED_TRANSCRIPTION_IDS: readonly TranscriptionProviderId[] = ["openai_whisper", "assemblyai"];

// Real bug, confirmed live (2026-08-06) — the Admin AI Providers catalogue
// (lib/admin/ai-providers.ts) lists "gpt4o_transcribe" ("OpenAI (gpt-4o-
// transcribe)") as a selectable TRANSCRIPTION provider, but no adapter class
// was ever built for it (deliberately — see assemblyai.provider.ts's own
// comment: gpt-4o-transcribe/mini drop word-level timestamps entirely, a
// hard requirement this pipeline's detectSilenceGaps() depends on). Before
// this fix, an admin who enabled it with a valid API key still hit the
// factory's `default` case (lib/providers/transcription/index.ts), which
// silently returned a MockTranscriptionProvider instead — indistinguishable
// from a real provider until generation completed and something downstream
// (ai-edit-jobs.ts's own MOCK_PROVIDER_ID check) caught the mock output
// after the fact. Fixed by filtering the admin-enabled priority list down
// to only real, implemented adapters *before* instantiating anything: a
// valid enabled provider (AssemblyAI/Whisper) is always used normally, and
// an enabled-but-unimplemented id is skipped rather than masquerading as
// mock. Only when NOTHING real remains do we fail — immediately, with a
// specific message naming exactly which enabled id has no real
// implementation, rather than a generic "no providers configured" or a
// silently-wrong mock transcript.
function partitionByImplementation(ids: string[]): { implemented: TranscriptionProviderId[]; unimplemented: string[] } {
  const implemented: TranscriptionProviderId[] = [];
  const unimplemented: string[] = [];
  for (const id of ids) {
    if ((IMPLEMENTED_TRANSCRIPTION_IDS as readonly string[]).includes(id)) {
      implemented.push(id as TranscriptionProviderId);
    } else {
      unimplemented.push(id);
    }
  }
  return { implemented, unimplemented };
}

// Generation Engine entry point for speech-to-text — same failover/retry/
// timeout/cost-tracking/health-monitoring as LLM/Image/Voice/Video, for
// free, because the engine is generic over GenerationCategory.
export async function transcribeAudio(
  req: TranscriptionRequest,
  context?: GenerationContext
): Promise<TranscriptionResultWithProvider> {
  const priority = await listEnabledProviderConfigs("TRANSCRIPTION");
  const { implemented, unimplemented } = partitionByImplementation(priority);

  if (implemented.length === 0 && unimplemented.length > 0) {
    throw new Error(
      `TRANSCRIPTION provider(s) enabled in Admin → AI Providers have no real implementation and were skipped: ${unimplemented.join(", ")}. ` +
        "gpt-4o-transcribe/mini specifically do not support word-level timestamps, which this pipeline requires — enable AssemblyAI or a real Whisper-based provider instead."
    );
  }

  const providers = await Promise.all(implemented.map((id) => instantiateTranscriptionProvider(id)));

  return runGeneration({
    category: "TRANSCRIPTION",
    operation: "transcribe",
    providers,
    invoke: (provider) => provider.transcribe(req),
    getUsage: (result) => result.usage,
    context,
  });
}
