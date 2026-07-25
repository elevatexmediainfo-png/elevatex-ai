import { getStorageProvider } from "@/lib/providers/storage";
import type { ProviderRuntimeConfig } from "../credentials";
import type { VoiceGenerateRequest, VoiceGenerateResult, VoiceProvider } from "./types";

// ElevenLabs ships multilingual voices, but a single voice ID still needs to
// be chosen per language for acceptable pronunciation — adjust these to real
// voice IDs from the ElevenLabs dashboard when this provider goes live.
const VOICE_ID_BY_LANGUAGE: Record<string, string> = {
  EN: "21m00Tcm4TlvDq8ikWAM",
  HI: "21m00Tcm4TlvDq8ikWAM",
  HINGLISH: "21m00Tcm4TlvDq8ikWAM",
};

// Maps the admin-configured AVAILABLE_VOICES ids (Milestone 8 Scene Editor
// voice picker) to real ElevenLabs voice ids. Adjust to real catalogue ids
// from the ElevenLabs dashboard when this provider goes live; an unmapped or
// "default" studio voiceId falls back to VOICE_ID_BY_LANGUAGE.
const ELEVENLABS_VOICE_ID_BY_STUDIO_VOICE: Record<string, string> = {
  warm_female: "EXAVITQu4vr4xnSDxMaL",
  confident_male: "29vD33N1CtxCmqQRPOHJ",
};

function estimateDurationSeconds(script: string): number {
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round((wordCount / 150) * 60));
}

// Real adapter — plain REST call against ElevenLabs' text-to-speech endpoint.
// Credentials resolved by lib/providers/credentials.ts (Admin AI Providers
// panel, falling back to ELEVENLABS_API_KEY) and injected here. ElevenLabs
// streams raw audio bytes back (no hosted URL), so this routes the result
// through the Storage Provider to get a durable, public URL — composing
// providers like this is expected; only business logic is forbidden from
// depending on a vendor directly.
export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly id = "elevenlabs";
  readonly category = "VOICE" as const;
  readonly model = "eleven_multilingual_v2";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  async generate(req: VoiceGenerateRequest): Promise<VoiceGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "elevenlabs is enabled but no API key is configured (Admin → AI Providers, or ELEVENLABS_API_KEY)."
      );
    }

    const voiceId =
      (req.voiceId && ELEVENLABS_VOICE_ID_BY_STUDIO_VOICE[req.voiceId]) ||
      VOICE_ID_BY_LANGUAGE[req.contentLanguage] ||
      VOICE_ID_BY_LANGUAGE.EN;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: req.script,
        model_id: this.model,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const audioBuffer = await res.arrayBuffer();
    const storage = await getStorageProvider();
    const { url } = await storage.upload({
      key: `voiceovers/${Date.now()}-${voiceId}.mp3`,
      data: Buffer.from(audioBuffer),
      contentType: "audio/mpeg",
    });

    return {
      audioUrl: url,
      durationSeconds: estimateDurationSeconds(req.script),
      usage: { characters: req.script.length },
    };
  }
}
