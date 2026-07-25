import type { ProviderRuntimeConfig } from "../credentials";
import { pollUntilSettled } from "../poll";
import type { VideoRenderRequest, VideoRenderResult, VideoProvider } from "./types";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // ~5 minutes
const DEFAULT_MODEL = "video-01";

// Best-effort adapter — MiniMax's Hailuo text-to-video API. Defaults to
// disabled (see prisma ProviderConfig.enabled) until an admin turns it on
// and supplies a key, per Milestone 10's "feature flag expensive providers"
// requirement. NOT verified against a live account — confirm the endpoint
// host/response field names still match current docs/account access tier
// before depending on it in production.
export class HailuoVideoProvider implements VideoProvider {
  readonly id = "hailuo";
  readonly category = "VIDEO" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async render(req: VideoRenderRequest): Promise<VideoRenderResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("hailuo is enabled but no API key is configured (Admin → AI Providers).");
    }
    const authHeader = { Authorization: `Bearer ${apiKey}` };

    const createRes = await fetch("https://api.minimax.chat/v1/video_generation", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: req.script,
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");
      throw new Error(`Hailuo task create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }
    const created = await createRes.json();
    const taskId: string | undefined = created.task_id;
    if (!taskId) {
      throw new Error("Hailuo did not return a task_id.");
    }

    const fileId = await pollUntilSettled(
      async () => {
        const pollRes = await fetch(`https://api.minimax.chat/v1/query/video_generation?task_id=${taskId}`, {
          headers: authHeader,
        });
        if (!pollRes.ok) return { status: "pending" as const };

        const polled = await pollRes.json();
        if (polled.status === "Success") {
          if (!polled.file_id) {
            return { status: "failed" as const, error: "task succeeded with no file_id in response" };
          }
          return { status: "succeeded" as const, data: polled.file_id as string };
        }
        if (polled.status === "Fail") {
          return { status: "failed" as const, error: polled.base_resp?.status_msg ?? "no error detail" };
        }
        return { status: "pending" as const };
      },
      { intervalMs: POLL_INTERVAL_MS, maxAttempts: MAX_POLL_ATTEMPTS, label: "Hailuo task" }
    );

    const fileRes = await fetch(`https://api.minimax.chat/v1/files/retrieve?file_id=${fileId}`, {
      headers: authHeader,
    });
    if (!fileRes.ok) {
      const body = await fileRes.text().catch(() => "");
      throw new Error(`Hailuo file retrieve failed (${fileRes.status}): ${body.slice(0, 300)}`);
    }
    const fileJson = await fileRes.json();
    const videoUrl: string | undefined = fileJson.file?.download_url;
    if (!videoUrl) {
      throw new Error("Hailuo file retrieve returned no download_url.");
    }

    return { videoUrl, durationSeconds: req.durationSeconds, providerRef: taskId, usage: { seconds: req.durationSeconds } };
  }

  // Honest limitation, not a fake — see replicate.provider.ts's identical
  // gap. Hailuo's generation API produces clips; it has no generic
  // multi-clip concat/compositing capability.
  async mergeScenes(): Promise<VideoRenderResult> {
    throw new Error(
      "hailuo has no generic scene-merge capability — configure a dedicated video-editing/concat provider for merge, or use the mock pipeline for end-to-end scene merging today."
    );
  }

  async composeTimeline(): Promise<VideoRenderResult> {
    throw new Error(
      "hailuo has no multi-track timeline-compositing capability — configure a dedicated video-editing/compositing provider for Export, or use the mock pipeline for end-to-end export today."
    );
  }
}
