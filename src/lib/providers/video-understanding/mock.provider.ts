import type { VideoUnderstandingProvider, VideoUnderstandingRequest, VideoUnderstandingResult } from "./types";

// Default provider (selected when no VIDEO_UNDERSTANDING ProviderConfig is
// enabled) — deterministic, empty-but-well-formed analysis so the rest of
// the pipeline (merge, persistence, UI) is exercisable without API
// credentials. Same simulated-latency pattern as the other category mocks.
export class MockVideoUnderstandingProvider implements VideoUnderstandingProvider {
  readonly id = "mock";
  readonly category = "VIDEO_UNDERSTANDING" as const;

  async analyze(req: VideoUnderstandingRequest): Promise<VideoUnderstandingResult> {
    void req;
    await new Promise((resolve) => setTimeout(resolve, 1200));

    return {
      emphasisMoments: [],
      emotionBeats: [],
      visualContext: [],
      gestures: [],
      flaggedSegments: [],
      durationSeconds: 0,
      providerRef: `mock-video-understanding-${Date.now()}`,
    };
  }
}
