import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 60; // ~4 minutes
const DEFAULT_MODEL = "gen3a_turbo";
const RUNWAY_API_VERSION = "2024-11-06";

// Best-effort adapter — RunwayML's Gen-3 text-to-video API. Defaults to
// disabled (see prisma ProviderConfig.enabled) until an admin turns it on
// and supplies a key, per Milestone 10's "feature flag expensive providers"
// requirement. NOT verified against a live account — confirm the endpoint
// host/required API version header still match current docs/account access
// tier before depending on it in production.
export class RunwayVideoProvider implements VideoProvider {
  readonly id = "runway";
  readonly category = "VIDEO" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("runway is enabled but no API key is configured (Admin → AI Providers).");
    }
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_API_VERSION,
      "Content-Type": "application/json",
    };

    const createRes = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        promptText: req.script,
        ratio: req.aspectRatio === "RATIO_9_16" ? "768:1280" : req.aspectRatio === "RATIO_1_1" ? "1024:1024" : "1280:768",
        duration: req.durationSeconds,
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Runway task create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = await createRes.json();
    const taskId: string | undefined = created.id;
    if (!taskId) {
      throw new Error("Runway did not return a task id.");
    }

    const data = await pollUntilSettled(
      async () => {
        const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, { headers });
        if (!pollRes.ok) return { status: "pending" as const };

        const polled = await pollRes.json();
        if (polled.status === "SUCCEEDED") {
          const videoUrl: string | undefined = Array.isArray(polled.output) ? polled.output[0] : undefined;
          if (!videoUrl) {
            return { status: "failed" as const, error: "task succeeded with no output URL in response" };
          }
          return { status: "succeeded" as const, data: { videoUrl } };
        }
        if (polled.status === "FAILED") {
          return { status: "failed" as const, error: polled.failure ?? polled.failureCode ?? "no error detail" };
        }
        // RUNNING or PENDING — keep polling.
        return { status: "pending" as const };
      },
      { intervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_POLL_ATTEMPTS, label: "Runway task" }
    );

    return { videoUrl: data.videoUrl, durationSeconds: req.durationSeconds, providerRef: taskId, usage: { seconds: req.durationSeconds } };
  }

  // Honest limitation, not a fake — see replicate.provider.ts's identical
  // gap. Runway's generation API produces clips; it has no generic
  // multi-clip concat/compositing capability exposed here.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "runway has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "runway has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
