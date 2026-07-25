import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

import { getStorageProvider } from "@/lib/providers/storage";
import type { VoiceGenerateRequest, VoiceGenerateResult, VoiceProvider } from "./types";

// Real, free, no-API-key TTS fallback (2026-07-25) — added specifically so
// a video generation never has to hard-block or ship fake narration just
// because ElevenLabs is unreachable (e.g. its free-plan library-voice
// restriction, found live). Wraps Microsoft Edge's "Read Aloud" speech
// synthesis service over the same WebSocket protocol the Edge browser
// itself uses — real neural voices, genuinely free, zero signup/API key.
// Verified live end-to-end from this environment before wiring it in (real
// MP3 bytes returned from Microsoft's actual service, not assumed).
//
// Real, disclosed tradeoff: this is an UNOFFICIAL, reverse-engineered
// integration (Microsoft publishes no public API for it) — it could change
// or be rate-limited/blocked without notice, unlike a documented, contracted
// vendor API. That's exactly why it sits BEHIND elevenlabs in the default
// priority order, not in front of it: a real paid vendor when available,
// a real free safety net when not, never a replacement for wanting to pay
// for ElevenLabs's actual voice catalogue.
const VOICE_NAME_BY_LANGUAGE: Record<string, string> = {
  EN: "en-US-AriaNeural",
  // Edge TTS has no single "Hinglish" locale (unlike ElevenLabs's
  // multilingual model, which auto-detects code-switching within one
  // voice) — the Hindi neural voice is the closest real option for
  // code-switched Hindi-English text, same reasoning ElevenLabsVoiceProvider
  // already applies by collapsing HINGLISH onto its own single voice id.
  HI: "hi-IN-SwaraNeural",
  HINGLISH: "hi-IN-SwaraNeural",
};

function estimateDurationSeconds(script: string): number {
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round((wordCount / 150) * 60));
}

export class EdgeTtsVoiceProvider implements VoiceProvider {
  readonly id = "edge_tts";
  readonly category = "VOICE" as const;
  readonly model = "edge-tts (unofficial, free)";

  // No constructor config — nothing to inject. Real adapters that need
  // vendor credentials (ElevenLabsVoiceProvider) take a ProviderRuntimeConfig;
  // this one deliberately takes none, since it needs no API key at all.

  async generate(req: VoiceGenerateRequest): Promise<VoiceGenerateResult> {
    const voiceName = VOICE_NAME_BY_LANGUAGE[req.contentLanguage] ?? VOICE_NAME_BY_LANGUAGE.EN;

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(req.script);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: Error) => reject(err));
    });
    tts.close();

    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length === 0) {
      throw new Error("edge_tts returned no audio data.");
    }

    const storage = await getStorageProvider();
    const { url } = await storage.upload({
      key: `voiceovers/${Date.now()}-edge-${voiceName}.mp3`,
      data: audioBuffer,
      contentType: "audio/mpeg",
    });

    return {
      audioUrl: url,
      durationSeconds: estimateDurationSeconds(req.script),
      usage: { characters: req.script.length },
    };
  }
}
