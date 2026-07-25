import type { VoiceGenerateRequest, VoiceGenerateResult, VoiceProvider } from "./types";

// Default provider (selected when PROVIDER_VOICE_PRIORITY has no other entry
// available) — returns a public domain sample
// audio clip so the voiceover pipeline step is fully exercisable without API
// credentials. Duration is estimated from script length (rough words-per-
// minute heuristic), same simulated-latency pattern as the other mocks.
export class MockVoiceProvider implements VoiceProvider {
  readonly id = "mock";
  readonly category = "VOICE" as const;

  async generate(req: VoiceGenerateRequest): Promise<VoiceGenerateResult> {
    await new Promise((resolve) => setTimeout(resolve, 900));

    const wordCount = req.script.split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(5, Math.round((wordCount / 150) * 60));

    return {
      audioUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
      durationSeconds,
      providerRef: `mock-voice-${Date.now()}`,
    };
  }
}
