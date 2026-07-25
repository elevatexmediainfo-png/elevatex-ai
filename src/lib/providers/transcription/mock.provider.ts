import type { TranscriptionRequest, TranscriptionResult, TranscriptionProvider } from "./types";

// Default provider (selected when no Transcription ProviderConfig is enabled)
// — returns a deterministic, fixed-length fake transcript so the speech
// pipeline (silence/paragraph detection, context analysis, visual planning)
// is fully exercisable without API credentials. Same simulated-latency
// pattern as the other category mocks.
const MOCK_SENTENCES = [
  "Hi everyone, thanks for joining me today.",
  "I want to talk about how our product helps teams move faster.",
  "Last quarter we shipped three major features.",
  "Customers told us they saved hours every single week.",
  "Let me show you a quick example of how it works.",
  "If you sign up today, you get a free trial for thirty days.",
  "Thanks for watching, and see you next time.",
];

export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly id = "mock";
  readonly category = "TRANSCRIPTION" as const;

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const segments: TranscriptionResult["segments"] = [];
    const words: TranscriptionResult["words"] = [];
    let cursorMs = 0;

    for (const sentence of MOCK_SENTENCES) {
      const sentenceWords = sentence.split(/\s+/).filter(Boolean);
      const startMs = cursorMs;
      for (const word of sentenceWords) {
        const wordStartMs = cursorMs;
        const wordEndMs = wordStartMs + 350;
        words.push({ word, startMs: wordStartMs, endMs: wordEndMs });
        cursorMs = wordEndMs;
      }
      segments.push({ text: sentence, startMs, endMs: cursorMs });
      cursorMs += 1500; // simulated pause between sentences, for silence-gap detection to find
    }

    return {
      segments,
      words,
      language: req.language ?? "en",
      durationSeconds: Math.round(cursorMs / 1000),
      providerRef: `mock-transcription-${Date.now()}`,
    };
  }
}
