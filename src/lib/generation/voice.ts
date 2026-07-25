import { prisma } from "@/lib/prisma";
import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { instantiateVoiceProvider } from "@/lib/providers/voice";
import type { VoiceGenerateRequest, VoiceGenerateResultWithProvider, VoiceProviderId } from "@/lib/providers/voice";
import { runGeneration } from "./engine";
import { MOCK_PROVIDER_ID } from "./types";
import type { GenerationContext } from "./types";

// edge_tts (2026-07-25) is a real, free, zero-credential TTS fallback (see
// providers/voice/edge-tts.provider.ts) — deliberately treated as an
// implicit safety net rather than just another catalogue entry a founder
// has to remember to enable. Every OTHER category's priority list is purely
// DB-driven (listEnabledProviderConfigs) because every other provider needs
// real credentials an admin must supply anyway, so "not configured yet"
// and "deliberately off" are indistinguishable — fine, there's nothing
// useful to do without a key. edge_tts breaks that assumption: it needs no
// key, so "not configured yet" (no ProviderConfig row exists) should mean
// "available," not "off." An explicit row with enabled:false is still
// honored as a real opt-out.
async function resolveVoiceProviderChain(): Promise<VoiceProviderId[]> {
  const priority = (await listEnabledProviderConfigs("VOICE")) as VoiceProviderId[];
  if (priority.includes("edge_tts")) return priority;

  const row = await prisma.providerConfig.findUnique({
    where: { category_providerId: { category: "VOICE", providerId: "edge_tts" } },
  });
  if (row && !row.enabled) return priority; // explicit opt-out — respected

  return [...priority, "edge_tts"];
}

// Generation Engine entry point for voiceover generation — replaces direct
// getVoiceProvider() calls in the queue processor. Returns
// VoiceGenerateResultWithProvider (not the bare VoiceGenerateResult), same
// pattern as renderVideo()'s VideoRenderResultWithProvider — every caller
// must be able to see which provider actually served the result and check
// it against MOCK_PROVIDER_ID before treating it as real.
export async function generateVoiceover(
  req: VoiceGenerateRequest,
  context?: GenerationContext
): Promise<VoiceGenerateResultWithProvider> {
  const priority = await resolveVoiceProviderChain();
  const providers = await Promise.all(priority.map((id) => instantiateVoiceProvider(id)));

  return runGeneration({
    category: "VOICE",
    operation: "voiceover",
    providers,
    invoke: (provider) => provider.generate(req),
    getUsage: (result) => result.usage,
    context,
  });
}

export interface VoiceoverOrDegradeResult {
  /** Null when no real voice provider succeeded — narrationSkippedReason explains why. */
  voice: VoiceGenerateResultWithProvider | null;
  narrationSkippedReason: string | null;
}

// Real-resilience entry point (2026-07-25) for every "generate a whole
// video" flow (FILM, Quick Video, GENERATED) — as opposed to
// generateVoiceover() above, which a dedicated "regenerate just the
// voiceover" user action should keep calling directly, since silently
// returning null there would look like nothing happened to a user who
// explicitly asked for a new voiceover.
//
// Two distinct failure shapes both degrade the same way: every real
// provider in the chain (including edge_tts) threw (generateVoiceover()
// itself throws AllProvidersFailedError), or the chain fell through to the
// mock placeholder (a real, non-throwing "success" the caller must still
// never treat as real narration — same standard the earlier mock-fallback
// fix established). Neither case blocks the video: both log clearly and
// return a null voice + a human-readable reason the caller can surface,
// instead of throwing and discarding an otherwise-successful video render.
export async function generateVoiceoverOrDegrade(
  req: VoiceGenerateRequest,
  context?: GenerationContext
): Promise<VoiceoverOrDegradeResult> {
  try {
    const voice = await generateVoiceover(req, context);
    if (voice.providerId === MOCK_PROVIDER_ID) {
      const reason =
        "No real VOICE provider (ElevenLabs or the free Edge TTS fallback) was reachable — proceeding without narration.";
      console.warn(`[voice] narration skipped: ${reason}`, context);
      return { voice: null, narrationSkippedReason: reason };
    }
    return { voice, narrationSkippedReason: null };
  } catch (err) {
    const reason = `Voice generation failed (${err instanceof Error ? err.message : String(err)}) — proceeding without narration.`;
    console.warn(`[voice] narration skipped: ${reason}`, context);
    return { voice: null, narrationSkippedReason: reason };
  }
}
