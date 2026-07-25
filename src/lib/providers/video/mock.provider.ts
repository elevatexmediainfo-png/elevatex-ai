import type {
  VideoComposeRequest,
  VideoMergeRequest,
  VideoRenderRequest,
  VideoRenderResult,
  VideoProvider,
} from "./types";

// Default provider (selected when PROVIDER_VIDEO_PRIORITY has no other entry
// available) — simulates a render API (e.g. a
// Runway/HeyGen-class text-to-video service) and returns a public sample
// video so the full pipeline (queue -> preview -> paid download) is
// exercisable end-to-end without a real render budget. Thumbnail generation
// is NOT this provider's job — see lib/providers/image. Ignores
// quality/watermarkText (the sample asset is fixed); a real adapter applies
// them to its render request, as ReplicateVideoProvider does.
export class MockVideoProvider implements VideoProvider {
  readonly id = "mock";
  readonly category = "VIDEO" as const;

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    // Simulate render time proportional to duration, capped so dev/demo stays fast.
    const simulatedMs = Math.min(4000, 800 + req.durationSeconds * 40);
    await new Promise((resolve) => setTimeout(resolve, simulatedMs));

    return {
      videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      durationSeconds: req.durationSeconds,
      providerRef: `mock-video-${Date.now()}`,
    };
  }

  // Real concatenation (with transitions) is out of scope for the mock —
  // simulates latency proportional to scene count/total duration and returns
  // the same canned sample, so the merge step is exercisable end-to-end in
  // dev/demo without an ffmpeg dependency.
  async mergeScenes(req: VideoMergeRequest): Promise<VideoRenderResult> {
    const totalDuration = req.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    const simulatedMs = Math.min(6000, 500 * req.scenes.length + totalDuration * 20);
    await new Promise((resolve) => setTimeout(resolve, simulatedMs));

    return {
      videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      durationSeconds: totalDuration,
      providerRef: `mock-merge-${Date.now()}`,
    };
  }

  // Milestone 9 Export System — real multi-track compositing (text/sticker/
  // caption overlays atop video/image/audio layers) is out of scope for the
  // mock, same honesty trade-off as mergeScenes() above: simulates latency
  // proportional to clip count/total duration and returns the same canned
  // sample so Export is exercisable end-to-end without a real compositor.
  async composeTimeline(req: VideoComposeRequest): Promise<VideoRenderResult> {
    const simulatedMs = Math.min(8000, 300 * req.clips.length + req.totalDurationMs / 50);
    await new Promise((resolve) => setTimeout(resolve, simulatedMs));

    return {
      videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      durationSeconds: Math.round(req.totalDurationMs / 1000),
      providerRef: `mock-compose-${Date.now()}`,
    };
  }
}
