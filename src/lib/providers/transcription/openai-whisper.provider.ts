import type { ProviderRuntimeConfig } from "../credentials";
import type { TranscriptionRequest, TranscriptionResult, TranscriptionProvider } from "./types";

// Real adapter — OpenAI's Whisper REST endpoint. Credentials resolved by
// lib/providers/credentials.ts (Admin AI Providers panel, falling back to
// the existing OPENAI_API_KEY — same key the LLM/Image adapters already
// use, no new secret to provision). Whisper takes the audio file itself
// (not a URL), so this fetches the asset's storage URL first and re-posts
// the bytes as multipart form data — the same "fetch from our own storage,
// forward to vendor" composition the ElevenLabs voice adapter already uses.
export class OpenAIWhisperTranscriptionProvider implements TranscriptionProvider {
  readonly id = "openai_whisper";
  readonly category = "TRANSCRIPTION" as const;
  readonly model = "whisper-1";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "openai_whisper is enabled but no API key is configured (Admin → AI Providers, or OPENAI_API_KEY)."
      );
    }

    const audioRes = await fetch(req.audioUrl);
    if (!audioRes.ok) {
      throw new Error(`Could not fetch source audio for transcription (${audioRes.status}).`);
    }
    const audioBuffer = await audioRes.arrayBuffer();

    const form = new FormData();
    form.append("file", new Blob([audioBuffer]), "audio");
    form.append("model", this.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    if (req.language) form.append("language", req.language);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI Whisper request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      text: string;
      language?: string;
      duration?: number;
      segments?: { text: string; start: number; end: number }[];
      words?: { word: string; start: number; end: number }[];
    };

    return {
      segments: (data.segments ?? []).map((s) => ({
        text: s.text.trim(),
        startMs: Math.round(s.start * 1000),
        endMs: Math.round(s.end * 1000),
      })),
      words: (data.words ?? []).map((w) => ({
        word: w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
      })),
      language: data.language ?? req.language ?? "en",
      durationSeconds: data.duration ?? 0,
      usage: { seconds: data.duration },
    };
  }
}
